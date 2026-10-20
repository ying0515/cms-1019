// Per-machine locations. os.homedir() honors USERPROFILE (Windows) / HOME (POSIX), so tests
// redirect everything to a temp directory by setting those variables.
import { homedir } from 'node:os';
import { join } from 'node:path';

export const claudeDir = () => join(homedir(), '.claude');
export const reportDir = () => join(claudeDir(), 'token-report');
export const configPath = () => join(reportDir(), 'config.json');
export const workerLogPath = () => join(reportDir(), 'worker.log');
export const outboxDir = () => join(reportDir(), 'outbox');
export const rejectedDir = () => join(outboxDir(), 'rejected');
export const statePath = () => join(reportDir(), 'state.json');
export const projectsDir = () => join(claudeDir(), 'projects');
export const settingsPath = () => join(claudeDir(), 'settings.json');
