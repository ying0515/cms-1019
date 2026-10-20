// Project name for a session: the git remote's repository name, else the folder name.
import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';

/**
 * Repository name from a remote URL: last path segment without `.git`.
 * Handles `https://host/owner/x(.git)`, `ssh://git@host/owner/x.git` and `git@host:owner/x.git`.
 */
export function repoNameFromRemote(url) {
  const trimmed = url.trim().replace(/[\\/]+$/, '');
  const last = trimmed.split(/[/:\\]/).pop() ?? '';
  return last.replace(/\.git$/i, '');
}

export function projectName(cwd) {
  try {
    const url = execFileSync('git', ['-C', cwd, 'remote', 'get-url', 'origin'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
      timeout: 5000,
    });
    const name = repoNameFromRemote(url);
    if (name) return name;
  } catch {
    // not a git repo, no origin, or git missing -> fall back to the folder name
  }
  return basename(cwd.replace(/[\\/]+$/, ''));
}
