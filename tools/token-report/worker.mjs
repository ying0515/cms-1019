// Detached worker started by hook.mjs: queues the ending session in the outbox, then sends
// every pending outbox file. Usage: node worker.mjs '<SessionEnd hook input JSON>'
import {
  appendFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { parseTranscripts } from './parse.mjs';
import { configPath, outboxDir, projectsDir, rejectedDir, reportDir, statePath, workerLogPath } from './paths.mjs';
import { projectName } from './project.mjs';

const SEND_TIMEOUT_MS = Number(process.env.TOKEN_REPORT_SEND_TIMEOUT_MS) || 10_000; // per request; tests lower it
const CATCH_UP_MS = 7 * 24 * 3600 * 1000;

// worker.log is cut back to its newest half once it passes this size (~1 MB; tests lower it).
const LOG_MAX_BYTES = Number(process.env.TOKEN_REPORT_LOG_MAX_BYTES) || 1024 * 1024;

function log(message) {
  try {
    mkdirSync(reportDir(), { recursive: true });
    appendFileSync(workerLogPath(), `${new Date().toISOString()} ${message}\n`);
    if (statSync(workerLogPath()).size > LOG_MAX_BYTES) trimLog();
  } catch {
    // logging must never fail the worker
  }
}

/** Keeps the last ~half of the log, starting on a whole line. */
function trimLog() {
  const text = readFileSync(workerLogPath());
  let tail = text.subarray(text.length - Math.floor(LOG_MAX_BYTES / 2));
  const newline = tail.indexOf(10);
  if (newline >= 0) tail = tail.subarray(newline + 1);
  const temp = `${workerLogPath()}.${process.pid}.tmp`;
  writeFileSync(temp, tail);
  renameSync(temp, workerLogPath());
}

/** Main transcript plus every `<session>/subagents/*.jsonl` (the folder also holds .meta.json files). */
function readSessionFiles(transcriptPath) {
  const texts = [readFileSync(transcriptPath, 'utf8')];
  const subagentsDir = join(transcriptPath.replace(/\.jsonl$/i, ''), 'subagents');
  let names = [];
  try {
    names = readdirSync(subagentsDir).filter((n) => n.toLowerCase().endsWith('.jsonl'));
  } catch {
    // no subagents
  }
  for (const name of names.sort()) texts.push(readFileSync(join(subagentsDir, name), 'utf8'));
  return texts;
}

/** The first `cwd` named in a transcript (Claude Code's first line usually has none). */
function cwdFromTranscript(text) {
  for (const line of text.split(/\r?\n/)) {
    if (!line.includes('"cwd"')) continue;
    try {
      const { cwd } = JSON.parse(line);
      if (typeof cwd === 'string' && cwd) return cwd;
    } catch {
      // unparseable line: keep looking
    }
  }
  return null;
}

/** `session` = `{ sessionId, transcriptPath, cwd? }`; cwd falls back to the transcript, then the project folder name. */
function buildPayload(session, userId) {
  const texts = readSessionFiles(session.transcriptPath);
  const { items, skipped } = parseTranscripts(texts);
  const cwd = session.cwd || cwdFromTranscript(texts[0]);
  const project = cwd ? projectName(cwd) : basename(dirname(session.transcriptPath));
  return { payload: { sessionId: session.sessionId, userId, project, items }, skipped };
}

/** Builds a session's payload and queues it; sessions without usage are only logged. */
function queueSession(session, userId) {
  const { payload, skipped } = buildPayload(session, userId);
  if (skipped) log(`${payload.sessionId} skipped ${skipped} unparseable line(s)`);
  if (payload.items.length === 0) log(`${payload.sessionId} no usage to send`);
  else queue(payload);
}

/** Latest mtime of a session's main log and its `subagents/*.jsonl`. */
function sessionMtime(transcriptPath) {
  let latest = statSync(transcriptPath).mtimeMs;
  const subagentsDir = join(transcriptPath.replace(/\.jsonl$/i, ''), 'subagents');
  try {
    for (const name of readdirSync(subagentsDir)) {
      if (name.toLowerCase().endsWith('.jsonl')) latest = Math.max(latest, statSync(join(subagentsDir, name)).mtimeMs);
    }
  } catch {
    // no subagents
  }
  return latest;
}

const listDir = (dir) => {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
};

/**
 * Sessions under ~/.claude/projects/<dir>/<session>.jsonl changed in the last 7 days and after
 * `since` (ms; the last fully successful run). Covers sessions whose hook never ran.
 */
function catchUpSessions(since, now) {
  const after = Math.max(since, now - CATCH_UP_MS);
  const sessions = [];
  for (const dir of listDir(projectsDir())) {
    if (!dir.isDirectory()) continue;
    for (const file of listDir(join(projectsDir(), dir.name))) {
      if (!file.isFile() || !file.name.toLowerCase().endsWith('.jsonl')) continue;
      const transcriptPath = join(projectsDir(), dir.name, file.name);
      try {
        if (sessionMtime(transcriptPath) > after) {
          sessions.push({ sessionId: file.name.slice(0, -'.jsonl'.length), transcriptPath });
        }
      } catch {
        // deleted while scanning
      }
    }
  }
  return sessions;
}

/** Writes `outbox/<sessionId>.json`, replacing an older file for the same session. */
function queue(payload) {
  mkdirSync(outboxDir(), { recursive: true });
  const file = join(outboxDir(), `${payload.sessionId}.json`);
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(payload));
  renameSync(temp, file);
}

async function send(config, payload) {
  const url = `${config.apiUrl.replace(/\/+$/, '')}/api/agent-token-usage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': config.apiKey },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  const body = res.ok ? '' : (await res.text()).slice(0, 500);
  return { status: res.status, body };
}

/** Sends one outbox file. Returns 'sent', 'rejected' (400, moved aside) or 'kept' (retry next run). */
async function sendFile(config, file) {
  let payload;
  try {
    payload = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return 'sent'; // another worker already sent it
    log(`${basename(file)} unreadable, moved to rejected: ${err.message}`);
    moveToRejected(file);
    return 'rejected';
  }
  const what = `${payload.sessionId} ${payload.project}`;
  try {
    const { status, body } = await send(config, payload);
    log(`${what} sent ${payload.items.length} item(s) -> ${status}${body ? ` ${body}` : ''}`);
    if (status >= 200 && status < 300) {
      removeIfPresent(file);
      return 'sent';
    }
    if (status === 400) {
      // The API will never accept this payload: park it so it stops being retried.
      moveToRejected(file);
      return 'rejected';
    }
    return 'kept'; // 401, 5xx and the like
  } catch (err) {
    log(`${what} send failed: ${err.message}`);
    return 'kept';
  }
}

function moveToRejected(file) {
  mkdirSync(rejectedDir(), { recursive: true });
  try {
    renameSync(file, join(rejectedDir(), basename(file)));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

function removeIfPresent(file) {
  try {
    unlinkSync(file);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

function pendingFiles() {
  try {
    return readdirSync(outboxDir())
      .filter((n) => n.endsWith('.json'))
      .sort()
      .map((n) => join(outboxDir(), n));
  } catch {
    return [];
  }
}

function readState() {
  try {
    return JSON.parse(readFileSync(statePath(), 'utf8'));
  } catch {
    return {};
  }
}

function writeState(state) {
  const temp = `${statePath()}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(state));
  renameSync(temp, statePath());
}

async function main() {
  const startedAt = new Date();
  const input = process.argv[2] ? JSON.parse(process.argv[2]) : null; // no argument: catch-up + resend only
  let config;
  try {
    config = JSON.parse(readFileSync(configPath(), 'utf8'));
  } catch (err) {
    log(`${input?.session_id ?? 'run'} no config at ${configPath()}: ${err.message}`);
    return;
  }

  if (input?.session_id && input?.transcript_path) {
    try {
      queueSession({ sessionId: input.session_id, transcriptPath: input.transcript_path, cwd: input.cwd }, config.userId);
    } catch (err) {
      log(`${input.session_id} could not be read: ${err.message}`); // still resend the outbox below
    }
  }

  const since = Date.parse(readState().lastSuccessAt ?? '') || 0;
  for (const session of catchUpSessions(since, startedAt.getTime())) {
    if (session.sessionId === input?.session_id) continue;
    try {
      queueSession(session, config.userId);
    } catch (err) {
      log(`${session.sessionId} catch-up failed: ${err.message}`);
    }
  }

  const counts = { sent: 0, rejected: 0, kept: 0 };
  for (const file of pendingFiles()) counts[await sendFile(config, file)]++;
  // Only a run with nothing left to retry moves the catch-up window. A 400 is final (the file is
  // in rejected/), so it does not hold the window back; otherwise catch-up would resend it forever.
  if (counts.kept === 0) {
    writeState({ ...readState(), lastSuccessAt: startedAt.toISOString() });
  }
  log(`run done: sent ${counts.sent}, rejected ${counts.rejected}, kept ${counts.kept}`);
}

try {
  await main();
} catch (err) {
  log(`worker error: ${err?.stack ?? err}`);
}
