import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';

/***
 * Reconcile one generated app's install, Devtools app concerns, and frozen lockfile entirely inside its package root.
 * @todo Move project package reconciliation from the host adapter area into the projects application boundary.
 */
export async function reconcileProjectPackageRootAsync(
  projectPath: string,
  options: ProjectPackageReconciliationOptions = {},
): Promise<void> {
  const runCommandAsync = options.runCommandAsync ?? runProjectCommandAsync;
  await runCommandAsync('bun', ['install'], projectPath);

  const ankhExecutable = path.join(
    projectPath,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'ankh.cmd' : 'ankh',
  );
  await access(ankhExecutable);

  for (const scope of DEVTOOLS_APP_SCOPES) {
    await runCommandAsync(ankhExecutable, ['devtools', scope, 'sync', '.'], projectPath);
  }

  await runCommandAsync('bun', ['install', '--frozen-lockfile'], projectPath);
}

const COMMAND_SPAWN_TIMEOUT_MS = 30_000;
const COMMAND_HARD_TIMEOUT_MS = 10 * 60_000;
const COMMAND_KILL_GRACE_MS = 5_000;
const DEVTOOLS_APP_SCOPES = ['package', 'eslint', 'prettier', 'knip'] as const;

interface ProjectPackageReconciliationOptions {
  readonly runCommandAsync?: ProjectCommandRunner;
}

type ProjectCommandRunner = (
  command: string,
  args: readonly string[],
  cwd: string,
) => Promise<void>;

/*** Run one project-owned command with bounded start/runtime timeouts and escalating termination safeguards. */
async function runProjectCommandAsync(
  command: string,
  args: readonly string[],
  cwd: string,
): Promise<void> {
  const displayCommand = [command, ...args].join(' ');

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd,
      stdio: 'inherit',
      env: process.env,
    });
    let hardTimeout: ReturnType<typeof setTimeout> | undefined;
    let killTimeout: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    const spawnTimeout = setTimeout(() => {
      rejectWithTimeout(`${displayCommand} did not start within ${COMMAND_SPAWN_TIMEOUT_MS}ms`);
    }, COMMAND_SPAWN_TIMEOUT_MS);

    /*** Clear every timeout owned by this command lifecycle. */
    const clearTimers = () => {
      clearTimeout(spawnTimeout);
      if (hardTimeout) clearTimeout(hardTimeout);
      if (killTimeout) clearTimeout(killTimeout);
    };

    /*** Reject this command exactly once and clear all pending timeout work. */
    const rejectOnce = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimers();
      reject(error);
    };

    /*** Terminate an overdue command and reject its lifecycle exactly once. */
    function rejectWithTimeout(reason: string) {
      if (settled) return;
      if (child.exitCode === null) {
        child.kill('SIGTERM');
        killTimeout = setTimeout(() => {
          if (child.exitCode === null) child.kill('SIGKILL');
        }, COMMAND_KILL_GRACE_MS);
      }
      rejectOnce(new Error(`${reason} in ${cwd}.`));
    }

    child.once('spawn', () => {
      if (settled) return;
      clearTimeout(spawnTimeout);
      hardTimeout = setTimeout(() => {
        rejectWithTimeout(`${displayCommand} exceeded ${COMMAND_HARD_TIMEOUT_MS}ms`);
      }, COMMAND_HARD_TIMEOUT_MS);
    });

    child.once('error', (error) => {
      const spawnError = error as NodeJS.ErrnoException;
      const message =
        spawnError.code === 'ENOENT'
          ? `${command} was not found while running ${displayCommand} in ${cwd}.`
          : `Failed to start ${displayCommand} in ${cwd}: ${spawnError.message}`;
      rejectOnce(new Error(message));
    });

    child.once('close', (code, signal) => {
      if (settled) {
        clearTimers();
        return;
      }
      settled = true;
      clearTimers();
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          code === null
            ? `${displayCommand} terminated by signal ${signal ?? 'unknown'} in ${cwd}.`
            : `${displayCommand} failed with code ${code} in ${cwd}.`,
        ),
      );
    });
  });
}
