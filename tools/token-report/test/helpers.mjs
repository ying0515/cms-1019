// Test harness: temporary home directories, a fake ingest API, and child-process runners.
// Every test points HOME/USERPROFILE at a temp dir, so the real ~/.claude is never touched.
import { spawn } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const toolDir = join(here, '..');
export const fixturesDir = join(here, 'fixtures');

/** Creates an empty temp directory that is removed when the test ends. */
export function tempDir(t, prefix = 'token-report-') {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** Environment for a child process whose home directory is `home`. */
export function homeEnv(home, extra = {}) {
  const env = { ...process.env, HOME: home, USERPROFILE: home, GIT_CEILING_DIRECTORIES: tmpdir() };
  delete env.CLAUDE_CONFIG_DIR;
  return { ...env, ...extra };
}

/** Writes ~/.claude/token-report/config.json in `home`. */
export function writeConfig(home, config) {
  const dir = join(home, '.claude', 'token-report');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'config.json'), JSON.stringify(config, null, 2));
}

export function readWorkerLog(home) {
  try {
    return readFileSync(join(home, '.claude', 'token-report', 'worker.log'), 'utf8');
  } catch {
    return '';
  }
}

/**
 * Copies a fixture session (`<name>.jsonl` plus an optional `<name>/` folder with subagents)
 * into `home/.claude/projects/<projectDir>/` under the given session id.
 * Returns the transcript path the hook would receive.
 */
export function installTranscript(home, fixture, sessionId, projectDir = 'C--work-demo') {
  const dir = join(home, '.claude', 'projects', projectDir);
  mkdirSync(dir, { recursive: true });
  const transcriptPath = join(dir, `${sessionId}.jsonl`);
  cpSync(join(fixturesDir, `${fixture}.jsonl`), transcriptPath);
  try {
    cpSync(join(fixturesDir, fixture), join(dir, sessionId), { recursive: true });
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  return transcriptPath;
}

/**
 * Starts a fake ingest API on a random local port.
 * `status` is a number or `(body) => number` (default 204); `hang` never answers; `delayMs` delays each answer.
 */
export async function startFakeApi(t, { status = 204, hang = false, delayMs = 0 } = {}) {
  const requests = [];
  let notify = () => {};
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const request = { method: req.method, url: req.url, headers: req.headers, body: JSON.parse(body), at: Date.now() };
      requests.push(request);
      notify();
      if (hang) return;
      const code = typeof status === 'function' ? status(request.body) : status;
      const answer = code === 400 ? `bad payload: ${request.body.sessionId}` : '';
      setTimeout(() => res.writeHead(code).end(answer), delayMs);
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    requests,
    /** Resolves when `count` requests have arrived (or rejects after `ms`). */
    waitFor(count, ms = 10_000) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`expected ${count} request(s)`)), ms);
        const check = () => {
          if (requests.length >= count) {
            clearTimeout(timer);
            resolve(requests);
          }
        };
        notify = check;
        check();
      });
    },
  };
}

/** Runs a script in tools/token-report as a child process; resolves with exit code and output. */
export function runScript(script, { args = [], env, stdin, cwd } = {}) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn(process.execPath, [join(toolDir, script), ...args], { env, cwd, windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr, ms: Date.now() - started }));
    if (stdin !== undefined) child.stdin.end(stdin);
    else child.stdin.end();
  });
}

/** Runs the worker for one session the way the hook does (input JSON as the only argument). */
export function runWorker(home, input, extraEnv) {
  return runScript('worker.mjs', { args: [JSON.stringify(input)], env: homeEnv(home, extraEnv) });
}

/** A local URL nothing listens on: every request fails at once with a network error. */
export async function deadApiUrl() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return `http://127.0.0.1:${port}`;
}

export const reportPath = (home, ...parts) => join(home, '.claude', 'token-report', ...parts);

/** Session ids with a pending file in `outbox/` (or `outbox/rejected/` when `rejected`). */
export function outboxSessions(home, { rejected = false } = {}) {
  const dir = rejected ? reportPath(home, 'outbox', 'rejected') : reportPath(home, 'outbox');
  try {
    return readdirSync(dir)
      .filter((n) => n.endsWith('.json'))
      .map((n) => n.slice(0, -'.json'.length))
      .sort();
  } catch {
    return [];
  }
}

export function readState(home) {
  try {
    return JSON.parse(readFileSync(reportPath(home, 'state.json'), 'utf8'));
  } catch {
    return null;
  }
}

export function writeState(home, state) {
  mkdirSync(reportPath(home), { recursive: true });
  writeFileSync(reportPath(home, 'state.json'), JSON.stringify(state));
}

/** Sets a file's modified time to `ms` ago. */
export function ageFile(file, ms) {
  const when = new Date(Date.now() - ms);
  utimesSync(file, when, when);
}

/** Polls until `check()` is truthy (or rejects after `ms`). */
export async function waitUntil(check, what, ms = 15_000) {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
