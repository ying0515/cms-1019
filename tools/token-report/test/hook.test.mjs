// Process-level tests for hook.mjs: it must hand off to a detached worker and exit at once.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  homeEnv,
  installTranscript,
  readWorkerLog,
  runScript,
  startFakeApi,
  tempDir,
  waitUntil,
  writeConfig,
} from './helpers.mjs';

const SESSION = '0f5e3c1a-1111-4222-8333-944455556666';
// Claude Code gives SessionEnd hooks ~1.5 s; the hook must stay well inside that.
const BUDGET_MS = 1000;
// The detached worker gives up on a hanging API after this long, so each test can wait for it to finish.
const workerEnv = (home) => homeEnv(home, { TOKEN_REPORT_SEND_TIMEOUT_MS: '500' });

/** Waits until the detached worker has logged the end of its run, so no worker outlives the test. */
const workerDone = (home) => waitUntil(() => /run done:/.test(readWorkerLog(home)), 'the worker to finish', 5000);

function hookInput(transcriptPath, cwd) {
  return JSON.stringify({
    session_id: SESSION,
    transcript_path: transcriptPath,
    cwd,
    hook_event_name: 'SessionEnd',
    reason: 'prompt_input_exit',
  });
}

test('ending a session reports its usage through a detached worker', async (t) => {
  const home = tempDir(t);
  const api = await startFakeApi(t);
  writeConfig(home, { apiUrl: api.url, apiKey: 'k', userId: 'ying' });
  const transcriptPath = installTranscript(home, 'mixed-models', SESSION);

  const result = await runScript('hook.mjs', { env: workerEnv(home), stdin: hookInput(transcriptPath, tempDir(t)) });

  assert.equal(result.code, 0, result.stderr);
  const [request] = await api.waitFor(1);
  assert.equal(request.body.sessionId, SESSION);
  assert.equal(request.body.items.length, 3);
  await workerDone(home);
});

test('the hook returns immediately even when the API never answers', async (t) => {
  const home = tempDir(t);
  const api = await startFakeApi(t, { hang: true });
  writeConfig(home, { apiUrl: api.url, apiKey: 'k', userId: 'ying' });
  const transcriptPath = installTranscript(home, 'mixed-models', SESSION);

  const result = await runScript('hook.mjs', { env: workerEnv(home), stdin: hookInput(transcriptPath, tempDir(t)) });

  assert.equal(result.code, 0, result.stderr);
  assert.ok(result.ms < BUDGET_MS, `hook took ${result.ms} ms`);
  await api.waitFor(1); // the worker is still trying in the background
  await workerDone(home);
  assert.match(readWorkerLog(home), /send failed/);
});

test('the hook returns immediately when the API host is unreachable', async (t) => {
  const home = tempDir(t);
  // TEST-NET-1 address: connections are never answered.
  writeConfig(home, { apiUrl: 'http://192.0.2.1:5000', apiKey: 'k', userId: 'ying' });
  const transcriptPath = installTranscript(home, 'mixed-models', SESSION);

  const result = await runScript('hook.mjs', { env: workerEnv(home), stdin: hookInput(transcriptPath, tempDir(t)) });

  assert.equal(result.code, 0, result.stderr);
  assert.ok(result.ms < BUDGET_MS, `hook took ${result.ms} ms`);
  await workerDone(home);
});

test('the hook never fails the session, even on garbage input', async (t) => {
  const home = tempDir(t);
  const result = await runScript('hook.mjs', { env: homeEnv(home), stdin: 'not json' });
  assert.equal(result.code, 0);
  assert.equal(result.stderr, '');
  assert.ok(result.ms < BUDGET_MS, `hook took ${result.ms} ms`);
});
