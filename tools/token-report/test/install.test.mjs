// Process-level tests for install.mjs against a temp home (never the real ~/.claude/settings.json).
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { homeEnv, runScript, tempDir, toolDir } from './helpers.mjs';

const hookCommand = `node "${join(toolDir, 'hook.mjs').replaceAll('\\', '/')}"`;

const settingsFile = (home) => join(home, '.claude', 'settings.json');
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

function writeSettings(home, settings) {
  mkdirSync(join(home, '.claude'), { recursive: true });
  const text = JSON.stringify(settings, null, 2) + '\n';
  writeFileSync(settingsFile(home), text);
  return text;
}

const flags = ['--api-url', 'http://cms.local:5000', '--api-key', 'secret', '--user-id', 'ying'];

function install(home, { args = flags, stdin } = {}) {
  return runScript('install.mjs', { args, env: homeEnv(home), stdin });
}

const existing = {
  hooks: {
    SessionStart: [
      {
        matcher: '^(startup|resume|clear|compact|fork)$',
        hooks: [{ type: 'command', command: 'powershell -NoProfile -File herdr-agent-state.ps1 session', timeout: 10 }],
      },
    ],
    SessionEnd: [{ hooks: [{ type: 'command', command: 'other-tool --on-end' }] }],
  },
  statusLine: { type: 'command', command: 'status.sh' },
  theme: 'dark',
  enabledPlugins: { 'a@b': true },
};

test('writes the config file from the given values', async (t) => {
  const home = tempDir(t);
  const result = await install(home);
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(readJson(join(home, '.claude', 'token-report', 'config.json')), {
    apiUrl: 'http://cms.local:5000',
    apiKey: 'secret',
    userId: 'ying',
  });
});

test('adds the SessionEnd hook to a home without settings', async (t) => {
  const home = tempDir(t);
  const result = await install(home);
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(readJson(settingsFile(home)), {
    hooks: { SessionEnd: [{ hooks: [{ type: 'command', command: hookCommand }] }] },
  });
  assert.equal(existsSync(settingsFile(home) + '.bak'), false);
});

test('keeps every other setting and hook, and writes a backup first', async (t) => {
  const home = tempDir(t);
  const original = writeSettings(home, existing);

  const result = await install(home);

  assert.equal(result.code, 0, result.stderr);
  assert.equal(readFileSync(settingsFile(home) + '.bak', 'utf8'), original);
  const expected = structuredClone(existing);
  expected.hooks.SessionEnd.push({ hooks: [{ type: 'command', command: hookCommand }] });
  assert.deepEqual(readJson(settingsFile(home)), expected);
});

test('a second run changes nothing', async (t) => {
  const home = tempDir(t);
  const original = writeSettings(home, existing);
  await install(home);
  const afterFirst = readFileSync(settingsFile(home), 'utf8');
  const configFirst = readFileSync(join(home, '.claude', 'token-report', 'config.json'), 'utf8');

  const result = await install(home);

  assert.equal(result.code, 0, result.stderr);
  assert.equal(readFileSync(settingsFile(home), 'utf8'), afterFirst);
  assert.equal(readFileSync(settingsFile(home) + '.bak', 'utf8'), original, 'backup still holds the pre-install file');
  assert.equal(readFileSync(join(home, '.claude', 'token-report', 'config.json'), 'utf8'), configFirst);
  assert.match(result.stdout, /already/i);
});

test('an entry pointing at an old checkout is updated in place, not duplicated', async (t) => {
  const home = tempDir(t);
  const settings = structuredClone(existing);
  settings.hooks.SessionEnd.push({ hooks: [{ type: 'command', command: 'node "D:/old/tools/token-report/hook.mjs"' }] });
  writeSettings(home, settings);

  await install(home);

  const sessionEnd = readJson(settingsFile(home)).hooks.SessionEnd;
  assert.deepEqual(sessionEnd, [
    { hooks: [{ type: 'command', command: 'other-tool --on-end' }] },
    { hooks: [{ type: 'command', command: hookCommand }] },
  ]);
});

test('prompts for missing values, defaulting the API URL', async (t) => {
  const home = tempDir(t);
  const result = await install(home, { args: [], stdin: '\nprompted-key\nalice\n' });
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(readJson(join(home, '.claude', 'token-report', 'config.json')), {
    apiUrl: 'http://localhost:5000',
    apiKey: 'prompted-key',
    userId: 'alice',
  });
  assert.match(result.stdout, /API URL/);
});

test('refuses to touch a settings file that is not valid JSON', async (t) => {
  const home = tempDir(t);
  mkdirSync(join(home, '.claude'), { recursive: true });
  writeFileSync(settingsFile(home), '{ broken');
  const result = await install(home);
  assert.notEqual(result.code, 0);
  assert.equal(readFileSync(settingsFile(home), 'utf8'), '{ broken');
});
