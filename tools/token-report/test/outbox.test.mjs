// Process-level tests for the outbox, rejected folder, state file, catch-up and log cap.
// Each test runs worker.mjs against a temp home and a local fake ingest API.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { test } from 'node:test';
import {
  ageFile,
  deadApiUrl,
  installTranscript,
  outboxSessions,
  readState,
  readWorkerLog,
  reportPath,
  runWorker,
  startFakeApi,
  tempDir,
  writeConfig,
  writeState,
} from './helpers.mjs';

const A = 'aaaaaaaa-0000-4000-8000-000000000001';
const B = 'bbbbbbbb-0000-4000-8000-000000000002';

const config = (apiUrl) => ({ apiUrl, apiKey: 'k', userId: 'ying' });

/** Ends session `id` the way the hook does: one worker run with that session's hook input. */
async function endSession(t, home, id, fixture = 'mixed-models') {
  const transcriptPath = installTranscript(home, fixture, id);
  const result = await runWorker(home, { session_id: id, transcript_path: transcriptPath, cwd: tempDir(t) });
  assert.equal(result.code, 0, result.stderr);
  return transcriptPath;
}

test('a session ended while the API is down is sent once on the next run, and the outbox is emptied', async (t) => {
  const home = tempDir(t);
  writeConfig(home, config(await deadApiUrl()));
  await endSession(t, home, A);
  assert.deepEqual(outboxSessions(home), [A], 'kept for the next run');

  const api = await startFakeApi(t);
  writeConfig(home, config(api.url));
  await endSession(t, home, B);

  assert.deepEqual(api.requests.map((r) => r.body.sessionId).sort(), [A, B]);
  assert.deepEqual(outboxSessions(home), []);
  assert.match(readWorkerLog(home), /send failed/);
});

test('a 400 moves the file to the rejected folder and logs the response, without blocking the others', async (t) => {
  const home = tempDir(t);
  writeConfig(home, config(await deadApiUrl()));
  await endSession(t, home, A);

  const api = await startFakeApi(t, { status: (body) => (body.sessionId === A ? 400 : 204) });
  writeConfig(home, config(api.url));
  await endSession(t, home, B);

  assert.deepEqual(api.requests.map((r) => r.body.sessionId).sort(), [A, B]);
  assert.deepEqual(outboxSessions(home), []);
  assert.deepEqual(outboxSessions(home, { rejected: true }), [A]);
  assert.match(readWorkerLog(home), new RegExp(`${A} .*-> 400 bad payload: ${A}`));
});

test('a newer outbox file for the same session replaces the older one', async (t) => {
  const home = tempDir(t);
  const stale = { sessionId: A, userId: 'ying', project: 'stale', items: [] };
  mkdirSync(reportPath(home, 'outbox'), { recursive: true });
  writeFileSync(reportPath(home, 'outbox', `${A}.json`), JSON.stringify(stale));
  writeConfig(home, config(await deadApiUrl()));

  await endSession(t, home, A);

  assert.deepEqual(outboxSessions(home), [A]);
  const pending = JSON.parse(readFileSync(reportPath(home, 'outbox', `${A}.json`), 'utf8'));
  assert.notEqual(pending.project, 'stale');
  assert.equal(pending.items.length, 3);
});

test('when every send succeeds, state.lastSuccessAt is the time the run started', async (t) => {
  const home = tempDir(t);
  const api = await startFakeApi(t, { delayMs: 300 });
  writeConfig(home, config(api.url));
  const before = Date.now();

  await endSession(t, home, A);

  const at = Date.parse(readState(home)?.lastSuccessAt);
  assert.ok(at >= before - 1000, 'not older than the run');
  assert.ok(at <= api.requests[0].at, 'taken before sending, not after');
});

test('a partial failure does not advance state.lastSuccessAt', async (t) => {
  const home = tempDir(t);
  const earlier = new Date(Date.now() - 3600_000).toISOString();
  writeState(home, { lastSuccessAt: earlier });
  writeConfig(home, config(await deadApiUrl()));
  await endSession(t, home, A);

  const api = await startFakeApi(t, { status: (body) => (body.sessionId === A ? 503 : 204) });
  writeConfig(home, config(api.url));
  await endSession(t, home, B);

  assert.deepEqual(outboxSessions(home), [A]);
  assert.deepEqual(readState(home), { lastSuccessAt: earlier });
});

// A rejected payload is final (it sits in rejected/ for a human); holding the state back would
// make catch-up rebuild and resend it, and every session since, on every run for 7 days.
test('a 400 does not hold back state.lastSuccessAt, so the rejected session is not resent next run', async (t) => {
  const home = tempDir(t);
  const api = await startFakeApi(t, { status: 400 });
  writeConfig(home, config(api.url));
  await endSession(t, home, A);
  assert.ok(readState(home)?.lastSuccessAt);

  const result = await runWorker(home, null);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(api.requests.length, 1);
});

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const C = 'cccccccc-0000-4000-8000-000000000003';
const D = 'dddddddd-0000-4000-8000-000000000004';

/**
 * Installs a session that ended without the hook running. Its transcript starts with a line
 * without `cwd` (like Claude Code's `mode` line), then names `cwd` on a later line.
 */
function installCrashedSession(home, id, cwd, projectDir = 'C--other-project') {
  const transcriptPath = installTranscript(home, 'mixed-models', id, projectDir);
  const text = readFileSync(transcriptPath, 'utf8').replaceAll('C:\\\\work\\\\demo', JSON.stringify(cwd).slice(1, -1));
  writeFileSync(transcriptPath, `{"type":"mode","mode":"default"}\n${text}`);
  return transcriptPath;
}

test('catch-up sends a session changed since the last success that never ran the hook', async (t) => {
  const home = tempDir(t);
  writeState(home, { lastSuccessAt: new Date(Date.now() - HOUR).toISOString() });
  const crashedCwd = tempDir(t, 'crashed-project-');
  installCrashedSession(home, B, crashedCwd);
  const api = await startFakeApi(t);
  writeConfig(home, config(api.url));

  await endSession(t, home, A);

  const bySession = Object.fromEntries(api.requests.map((r) => [r.body.sessionId, r.body]));
  assert.deepEqual(Object.keys(bySession).sort(), [A, B]);
  assert.equal(bySession[B].project, basename(crashedCwd), 'project from the cwd in the transcript');
  assert.equal(bySession[B].items.length, 3);
  assert.equal(api.requests.length, 2, 'the ending session is not sent twice');
  assert.deepEqual(outboxSessions(home), []);
});

test('catch-up counts a session whose subagent log changed even if the main log did not', async (t) => {
  const home = tempDir(t);
  writeState(home, { lastSuccessAt: new Date(Date.now() - HOUR).toISOString() });
  const transcriptPath = installTranscript(home, 'with-subagents', C, 'C--other-project');
  ageFile(transcriptPath, 2 * DAY);
  const api = await startFakeApi(t);
  writeConfig(home, config(api.url));

  await endSession(t, home, A);

  assert.deepEqual(api.requests.map((r) => r.body.sessionId).sort(), [A, C]);
});

test('catch-up ignores sessions older than 7 days, and sessions unchanged since the last success', async (t) => {
  const home = tempDir(t);
  writeState(home, { lastSuccessAt: new Date(Date.now() - 2 * DAY).toISOString() });
  ageFile(installCrashedSession(home, C, tempDir(t)), 8 * DAY); // also older than the state: 7-day cap wins anyway
  ageFile(installCrashedSession(home, D, tempDir(t)), 3 * DAY); // inside 7 days but before the last success
  const api = await startFakeApi(t);
  writeConfig(home, config(api.url));

  await endSession(t, home, A);

  assert.deepEqual(api.requests.map((r) => r.body.sessionId), [A]);
});

test('without a state file, catch-up takes everything from the last 7 days and nothing older', async (t) => {
  const home = tempDir(t);
  ageFile(installCrashedSession(home, B, tempDir(t)), 6 * DAY);
  ageFile(installCrashedSession(home, C, tempDir(t)), 8 * DAY);
  const api = await startFakeApi(t);
  writeConfig(home, config(api.url));

  await endSession(t, home, A);

  assert.deepEqual(api.requests.map((r) => r.body.sessionId).sort(), [A, B]);
});

test('each run ends with one summary line', async (t) => {
  const home = tempDir(t);
  writeConfig(home, config(await deadApiUrl()));
  await endSession(t, home, A);
  const api = await startFakeApi(t, { status: (body) => (body.sessionId === A ? 400 : 204) });
  writeConfig(home, config(api.url));
  await endSession(t, home, B);

  const runs = readWorkerLog(home).split('\n').filter((l) => / run done:/.test(l));
  assert.equal(runs.length, 2);
  assert.match(runs[0], /run done: sent 0, rejected 0, kept 1$/);
  assert.match(runs[1], /run done: sent 1, rejected 1, kept 0$/);
});

test('the log is cut back to about half its cap once it passes the cap, keeping whole lines', async (t) => {
  const home = tempDir(t);
  const cap = 10_000;
  const old = Array.from({ length: 800 }, (_, i) => `2026-10-01T00:00:00.000Z old line ${i}`).join('\n') + '\n';
  mkdirSync(reportPath(home), { recursive: true });
  writeFileSync(reportPath(home, 'worker.log'), old); // ~36 KB, well over the cap
  const api = await startFakeApi(t);
  writeConfig(home, config(api.url));

  const transcriptPath = installTranscript(home, 'mixed-models', A);
  for (let run = 0; run < 3; run++) {
    const result = await runWorker(
      home,
      { session_id: A, transcript_path: transcriptPath, cwd: tempDir(t) },
      { TOKEN_REPORT_LOG_MAX_BYTES: String(cap) },
    );
    assert.equal(result.code, 0, result.stderr);
  }

  const log = readWorkerLog(home);
  const size = Buffer.byteLength(log);
  assert.ok(size <= cap + 1000, `log is ${size} bytes`);
  assert.ok(size >= cap / 4, `log kept recent history (${size} bytes)`);
  assert.match(log, /^\d{4}-\d\d-\d\dT/, 'starts on a whole line');
  assert.match(log, /run done: sent 1, rejected 0, kept 0\n$/);
});

for (const status of [500, 503, 401]) {
  test(`a ${status} keeps the file for the next run`, async (t) => {
    const home = tempDir(t);
    const api = await startFakeApi(t, { status });
    writeConfig(home, config(api.url));
    await endSession(t, home, A);

    assert.equal(api.requests.length, 1);
    assert.deepEqual(outboxSessions(home), [A]);
    assert.deepEqual(outboxSessions(home, { rejected: true }), []);
    assert.match(readWorkerLog(home), new RegExp(`-> ${status}`));
  });
}
