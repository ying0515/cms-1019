// Process-level tests: run worker.mjs against a temp home + fake ingest API, assert the POSTed payload.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';
import { describe, test } from 'node:test';
import {
  installTranscript,
  readWorkerLog,
  runWorker,
  startFakeApi,
  tempDir,
  writeConfig,
} from './helpers.mjs';

const SESSION = '42b40b91-7742-4c0a-a984-30d5ea1ff381';

/** Runs the worker for `fixture` with `cwd` (default: a temp non-git folder) and returns the one POST. */
async function submit(t, fixture, { cwd } = {}) {
  const home = tempDir(t);
  const api = await startFakeApi(t);
  writeConfig(home, { apiUrl: api.url, apiKey: 'test-key', userId: 'ying' });
  const transcriptPath = installTranscript(home, fixture, SESSION);
  const workCwd = cwd ?? tempDir(t, 'demo-project-');
  const result = await runWorker(home, {
    session_id: SESSION,
    transcript_path: transcriptPath,
    cwd: workCwd,
    hook_event_name: 'SessionEnd',
    reason: 'other',
  });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(api.requests.length, 1, 'exactly one POST');
  return { request: api.requests[0], home, cwd: workCwd };
}

const byKey = (items) =>
  Object.fromEntries(items.map(({ usageDate, model, ...tokens }) => [`${usageDate} ${model}`, tokens]));

test('lines repeated per content block count once, using the final usage of each message', async (t) => {
  const { request } = await submit(t, 'per-block-duplicates');
  assert.equal(request.method, 'POST');
  assert.equal(request.url, '/api/agent-token-usage');
  assert.equal(request.headers['x-api-key'], 'test-key');
  assert.equal(request.body.sessionId, SESSION);
  assert.equal(request.body.userId, 'ying');
  assert.deepEqual(request.body.items, [
    {
      usageDate: '2026-10-19',
      model: 'claude-opus-5-5',
      inputTokens: 4,
      outputTokens: 1322,
      cacheWriteTokens: 1200,
      cacheReadTokens: 11000,
    },
  ]);
});

test('<synthetic> messages are skipped', async (t) => {
  const { request } = await submit(t, 'synthetic');
  assert.deepEqual(byKey(request.body.items), {
    '2026-10-19 claude-sonnet-5-5': { inputTokens: 10, outputTokens: 40, cacheWriteTokens: 20, cacheReadTokens: 30 },
  });
});

test('messages whose four token counts are all zero are skipped', async (t) => {
  const { request } = await submit(t, 'all-zero');
  assert.deepEqual(Object.keys(byKey(request.body.items)), ['2026-10-19 claude-sonnet-5-5']);
});

test("a session crossing Taipei midnight is split by each message's Taipei date", async (t) => {
  const { request } = await submit(t, 'crosses-taipei-midnight');
  assert.deepEqual(byKey(request.body.items), {
    '2026-10-19 claude-opus-5-5': { inputTokens: 1, outputTokens: 10, cacheWriteTokens: 100, cacheReadTokens: 1000 },
    '2026-10-20 claude-opus-5-5': { inputTokens: 5, outputTokens: 50, cacheWriteTokens: 500, cacheReadTokens: 5000 },
  });
});

test('subagent logs are folded into the session; .meta.json files are ignored', async (t) => {
  const { request } = await submit(t, 'with-subagents');
  assert.deepEqual(byKey(request.body.items), {
    '2026-10-19 claude-haiku-5-5': { inputTokens: 5, outputTokens: 50, cacheWriteTokens: 0, cacheReadTokens: 500 },
    '2026-10-19 claude-opus-5-5': { inputTokens: 7, outputTokens: 70, cacheWriteTokens: 700, cacheReadTokens: 7000 },
    '2026-10-19 claude-sonnet-5-5': { inputTokens: 3, outputTokens: 30, cacheWriteTokens: 300, cacheReadTokens: 3000 },
  });
});

test('mixed models are summed separately per model', async (t) => {
  const { request } = await submit(t, 'mixed-models');
  assert.deepEqual(byKey(request.body.items), {
    '2026-10-19 claude-haiku-5-5': { inputTokens: 50, outputTokens: 5, cacheWriteTokens: 0, cacheReadTokens: 0 },
    '2026-10-19 claude-opus-5-5': { inputTokens: 3, outputTokens: 30, cacheWriteTokens: 300, cacheReadTokens: 3000 },
    '2026-10-19 claude-sonnet-5-5': { inputTokens: 7, outputTokens: 77, cacheWriteTokens: 70, cacheReadTokens: 700 },
  });
});

test('malformed lines are skipped and logged; the rest is still sent', async (t) => {
  const { request, home } = await submit(t, 'malformed-line');
  assert.deepEqual(byKey(request.body.items), {
    '2026-10-19 claude-opus-5-5': { inputTokens: 3, outputTokens: 30, cacheWriteTokens: 300, cacheReadTokens: 3000 },
  });
  assert.match(readWorkerLog(home), /skipped 2 unparseable line\(s\)/);
});

test('a session with no usage sends nothing', async (t) => {
  const home = tempDir(t);
  const api = await startFakeApi(t);
  writeConfig(home, { apiUrl: api.url, apiKey: 'k', userId: 'ying' });
  const transcriptPath = installTranscript(home, 'no-usage', SESSION);
  const result = await runWorker(home, { session_id: SESSION, transcript_path: transcriptPath, cwd: tempDir(t) });
  assert.equal(result.code, 0);
  assert.equal(api.requests.length, 0);
  assert.match(readWorkerLog(home), /no usage to send/);
});

test('without a config file the worker logs and sends nothing', async (t) => {
  const home = tempDir(t);
  const transcriptPath = installTranscript(home, 'mixed-models', SESSION);
  const result = await runWorker(home, { session_id: SESSION, transcript_path: transcriptPath, cwd: tempDir(t) });
  assert.equal(result.code, 0);
  assert.match(readWorkerLog(home), /no config/);
});

test('a rejected send is logged with its status (single attempt, no retry yet)', async (t) => {
  const home = tempDir(t);
  const api = await startFakeApi(t, { status: 400 });
  writeConfig(home, { apiUrl: api.url, apiKey: 'k', userId: 'ying' });
  const transcriptPath = installTranscript(home, 'mixed-models', SESSION);
  const result = await runWorker(home, { session_id: SESSION, transcript_path: transcriptPath, cwd: tempDir(t) });
  assert.equal(result.code, 0);
  assert.equal(api.requests.length, 1);
  assert.match(readWorkerLog(home), /-> 400/);
});

describe('project name', () => {
  /** Makes a git repo in a temp folder with the given origin URL (or none). */
  function repo(t, origin) {
    const dir = tempDir(t, 'repo-folder-');
    execFileSync('git', ['init', '-q', dir]);
    if (origin) execFileSync('git', ['-C', dir, 'remote', 'add', 'origin', origin]);
    return dir;
  }

  const forms = {
    'https with .git': 'https://github.com/ying0515/cms-1019.git',
    'https without .git': 'https://github.com/ying0515/cms-1019',
    'https with trailing slash': 'https://dev.azure.com/org/proj/_git/cms-1019/',
    'scp-style ssh': 'git@github.com:ying0515/cms-1019.git',
    'ssh:// URL': 'ssh://git@github.com:22/ying0515/cms-1019.git',
  };
  for (const [form, url] of Object.entries(forms)) {
    test(`is the repository name for a ${form} remote`, async (t) => {
      const { request } = await submit(t, 'mixed-models', { cwd: repo(t, url) });
      assert.equal(request.body.project, 'cms-1019');
    });
  }

  test('falls back to the folder name for a repo without origin', async (t) => {
    const cwd = repo(t, null);
    const { request } = await submit(t, 'mixed-models', { cwd });
    assert.equal(request.body.project, basename(cwd));
  });

  test('falls back to the folder name outside git', async (t) => {
    const { request, cwd } = await submit(t, 'mixed-models');
    assert.match(request.body.project, /^demo-project-/);
    assert.equal(request.body.project, basename(cwd));
  });
});
