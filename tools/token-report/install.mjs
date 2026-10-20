// One-time setup per machine: writes ~/.claude/token-report/config.json and merges the
// SessionEnd hook into the user-level ~/.claude/settings.json (backup in settings.json.bak).
//
// Usage: node tools/token-report/install.mjs [--api-url URL] [--api-key KEY] [--user-id ID]
// Values not given as flags are prompted for (one line each on stdin).
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { configPath, settingsPath, workerLogPath } from './paths.mjs';

const DEFAULT_API_URL = 'http://localhost:5000';
const hookPath = join(dirname(fileURLToPath(import.meta.url)), 'hook.mjs').replaceAll('\\', '/');
const hookCommand = `node "${hookPath}"`;
const isOurHook = (command) => typeof command === 'string' && /token-report[\\/]+hook\.mjs/.test(command);

function readJsonFile(file) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return { text: null, json: null };
    throw err;
  }
  try {
    return { text, json: JSON.parse(text) };
  } catch (err) {
    throw new Error(`${file} is not valid JSON (${err.message}); fix it and run again`);
  }
}

/** Asks each question in turn; works for a terminal and for piped stdin. */
async function ask(questions) {
  const rl = createInterface({ input: process.stdin, terminal: false });
  const lines = rl[Symbol.asyncIterator]();
  const answers = {};
  for (const { key, label, fallback } of questions) {
    process.stdout.write(fallback ? `${label} [${fallback}]: ` : `${label}: `);
    const { value, done } = await lines.next();
    answers[key] = (done ? '' : value).trim() || fallback || '';
    if (done) process.stdout.write('\n');
  }
  rl.close();
  return answers;
}

async function collectConfig() {
  const { values } = parseArgs({
    options: { 'api-url': { type: 'string' }, 'api-key': { type: 'string' }, 'user-id': { type: 'string' } },
  });
  const current = readJsonFile(configPath()).json ?? {};
  const config = { apiUrl: values['api-url'], apiKey: values['api-key'], userId: values['user-id'] };
  const questions = [
    { key: 'apiUrl', label: 'API URL', fallback: current.apiUrl ?? DEFAULT_API_URL },
    { key: 'apiKey', label: 'API key', fallback: current.apiKey },
    { key: 'userId', label: 'User ID (AppUser.UserId)', fallback: current.userId },
  ].filter((q) => config[q.key] === undefined);
  if (questions.length) Object.assign(config, await ask(questions));
  for (const [key, value] of Object.entries(config)) {
    if (!value) throw new Error(`${key} is required`);
  }
  return config;
}

/** Returns a copy of `settings` with our SessionEnd hook present exactly once. Other hooks untouched. */
function withHook(settings) {
  const next = structuredClone(settings ?? {});
  next.hooks ??= {};
  next.hooks.SessionEnd ??= [];
  for (const group of next.hooks.SessionEnd) {
    for (const hook of group.hooks ?? []) {
      if (isOurHook(hook.command)) {
        hook.command = hookCommand;
        return next;
      }
    }
  }
  next.hooks.SessionEnd.push({ hooks: [{ type: 'command', command: hookCommand }] });
  return next;
}

function writeIfChanged(file, text) {
  let current = null;
  try {
    current = readFileSync(file, 'utf8');
  } catch {
    // new file
  }
  if (current === text) return false;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  return true;
}

async function main() {
  const settingsFile = settingsPath();
  const settings = readJsonFile(settingsFile); // validate before asking anything
  const config = await collectConfig();

  const configChanged = writeIfChanged(configPath(), JSON.stringify(config, null, 2) + '\n');
  console.log(configChanged ? `Wrote ${configPath()}` : `Config already up to date: ${configPath()}`);

  const merged = JSON.stringify(withHook(settings.json), null, 2) + '\n';
  if (settings.text !== null && JSON.stringify(settings.json, null, 2) + '\n' === merged) {
    console.log(`SessionEnd hook already installed in ${settingsFile}`);
  } else {
    if (settings.text !== null) {
      copyFileSync(settingsFile, `${settingsFile}.bak`);
      console.log(`Backed up ${settingsFile} to ${settingsFile}.bak`);
    }
    writeIfChanged(settingsFile, merged);
    console.log(`Added SessionEnd hook to ${settingsFile}: ${hookCommand}`);
  }

  console.log(`
To verify: start a Claude Code session, send a prompt, exit it, then check
  ${workerLogPath()}   (expect "sent N item(s) -> 204")
and the report page /agent-token-report.`);
}

try {
  await main();
} catch (err) {
  console.error(`install failed: ${err.message}`);
  process.exitCode = 1;
}
