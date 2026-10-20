// Detached worker started by hook.mjs: builds one session's totals and POSTs them once.
// Usage: node worker.mjs '<SessionEnd hook input JSON>'
// Retries / outbox / catch-up are not implemented yet (ticket #11): a failed send is only logged.
import { appendFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTranscripts } from './parse.mjs';
import { configPath, reportDir, workerLogPath } from './paths.mjs';
import { projectName } from './project.mjs';

const SEND_TIMEOUT_MS = 10_000;

function log(message) {
  try {
    mkdirSync(reportDir(), { recursive: true });
    appendFileSync(workerLogPath(), `${new Date().toISOString()} ${message}\n`);
  } catch {
    // logging must never fail the worker
  }
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

function buildPayload(input, userId) {
  const { items, skipped } = parseTranscripts(readSessionFiles(input.transcript_path));
  return {
    payload: { sessionId: input.session_id, userId, project: projectName(input.cwd), items },
    skipped,
  };
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

async function main() {
  const input = JSON.parse(process.argv[2] ?? '');
  let config;
  try {
    config = JSON.parse(readFileSync(configPath(), 'utf8'));
  } catch (err) {
    log(`${input.session_id} no config at ${configPath()}: ${err.message}`);
    return;
  }

  const { payload, skipped } = buildPayload(input, config.userId);
  const skippedNote = skipped ? `; skipped ${skipped} unparseable line(s)` : '';
  if (payload.items.length === 0) {
    log(`${payload.sessionId} no usage to send${skippedNote}`);
    return;
  }

  try {
    const { status, body } = await send(config, payload);
    log(`${payload.sessionId} ${payload.project} sent ${payload.items.length} item(s) -> ${status}${body ? ` ${body}` : ''}${skippedNote}`);
  } catch (err) {
    log(`${payload.sessionId} ${payload.project} send failed: ${err.message}${skippedNote}`);
  }
}

try {
  await main();
} catch (err) {
  log(`worker error: ${err?.stack ?? err}`);
}
