// Claude Code SessionEnd hook: hands the hook input to a detached worker and exits at once.
// It must finish well inside the ~1.5 s SessionEnd budget and must never fail the session.
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const STDIN_WAIT_MS = 500;

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    const done = () => resolve(data);
    const timer = setTimeout(done, STDIN_WAIT_MS);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => {
      clearTimeout(timer);
      done();
    });
    process.stdin.on('error', () => {
      clearTimeout(timer);
      done();
    });
  });
}

try {
  const input = JSON.parse(await readStdin());
  if (input?.session_id && input?.transcript_path) {
    const worker = join(dirname(fileURLToPath(import.meta.url)), 'worker.mjs');
    spawn(process.execPath, [worker, JSON.stringify(input)], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }).unref();
  }
} catch {
  // never fail the session
}
process.exit(0);
