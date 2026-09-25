import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawnSync } from 'child_process';
import { projectRootDir } from './config.js';

/**
 * Path to the bundled docker compose file for Open Notebook.
 */
export function getComposeFilePath(): string {
  return path.join(projectRootDir, 'scripts', 'docker', 'open-notebook.docker-compose.yml');
}

/**
 * Checks if Colima binary is installed on the host system.
 */
export function isColimaInstalled(): boolean {
  try {
    const res = spawnSync('which', ['colima'], { encoding: 'utf8' });
    return res.status === 0 && !!res.stdout.trim();
  } catch {
    return false;
  }
}

/**
 * Checks whether Colima runtime is currently running.
 */
export function getColimaStatus(): { running: boolean; message: string } {
  if (!isColimaInstalled()) {
    return { running: false, message: 'Colima is not installed' };
  }
  try {
    const res = spawnSync('colima', ['status'], { encoding: 'utf8' });
    const output = ((res.stdout || '') + (res.stderr || '')).trim();
    if (res.status === 0 && output.includes('colima is running')) {
      return { running: true, message: 'colima is running' };
    }
    if (output.includes('colima is not running')) {
      return { running: false, message: 'colima is not running' };
    }
    return { running: false, message: output || 'colima is stopped' };
  } catch (e: any) {
    return { running: false, message: e.message };
  }
}

/**
 * Starts Colima container runtime.
 */
export function startColima(): void {
  console.log('Starting Colima runtime (colima start)...');
  execSync('colima start', { stdio: 'inherit' });
}

/**
 * Stops Colima container runtime.
 */
export function stopColima(): void {
  console.log('Stopping Colima runtime (colima stop)...');
  execSync('colima stop', { stdio: 'inherit' });
}

/**
 * Checks whether the Docker daemon is responding.
 */
export function isDockerRunning(): boolean {
  try {
    const res = spawnSync('docker', ['info'], { encoding: 'utf8', timeout: 5000 });
    return res.status === 0;
  } catch {
    return false;
  }
}

/**
 * Finds the available docker compose CLI tool ('docker compose' or 'docker-compose').
 */
export function resolveDockerComposeCmd(): string | null {
  try {
    const res1 = spawnSync('docker', ['compose', 'version'], { encoding: 'utf8' });
    if (res1.status === 0) return 'docker compose';
  } catch {}

  try {
    const res2 = spawnSync('docker-compose', ['version'], { encoding: 'utf8' });
    if (res2.status === 0) return 'docker-compose';
  } catch {}

  return null;
}

/**
 * Runs a Docker Compose command targeting a compose file.
 */
export function runDockerCompose(composePath: string, action: 'up' | 'down', extraArgs: string[] = []): void {
  const composeCmd = resolveDockerComposeCmd();
  if (!composeCmd) {
    throw new Error(
      'Neither "docker compose" nor "docker-compose" was found on your system.\n' +
      'On macOS with Homebrew, install via: brew install docker-compose'
    );
  }

  const args = `${composeCmd} -f "${composePath}" ${action} ${extraArgs.join(' ')}`.trim();
  execSync(args, { stdio: 'inherit' });
}

/**
 * Retrieves the status of running containers defined by a Docker Compose file.
 */
export function getComposeContainersStatus(composePath: string): string[] {
  const composeCmd = resolveDockerComposeCmd();
  if (!composeCmd || !fs.existsSync(composePath)) return [];

  try {
    const parts = composeCmd.split(' ');
    const bin = parts[0];
    const subArgs = parts.slice(1);
    const psOut = spawnSync(
      bin,
      [...subArgs, '-f', composePath, 'ps', '--format', '{{.Name}}: {{.Status}}'],
      { encoding: 'utf8' }
    );
    return (psOut.stdout || '').trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}
