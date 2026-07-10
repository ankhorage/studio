import { spawn } from 'child_process';

const BUN_INSTALL_SPAWN_TIMEOUT_MS = 30_000;
const BUN_INSTALL_HARD_TIMEOUT_MS = 10 * 60_000;
const BUN_INSTALL_KILL_GRACE_MS = 5_000;
type TimerHandle = ReturnType<typeof setTimeout>;

export async function runWorkspaceInstall(rootPath: string): Promise<void> {
  const command = 'bun install';

  await new Promise<void>((resolve, reject) => {
    const child = spawn('bun', ['install'], {
      cwd: rootPath,
      stdio: 'inherit',
      env: process.env,
    });

    const spawnTimeout = setTimeout(() => {
      rejectWithTimeout(`bun install did not start within ${BUN_INSTALL_SPAWN_TIMEOUT_MS}ms`);
    }, BUN_INSTALL_SPAWN_TIMEOUT_MS);
    let hardTimeout: TimerHandle | undefined;
    let killTimeout: TimerHandle | undefined;
    let settled = false;

    const clearTimers = () => {
      clearTimeout(spawnTimeout);
      if (hardTimeout) clearTimeout(hardTimeout);
      if (killTimeout) clearTimeout(killTimeout);
    };

    const rejectOnce = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimers();
      reject(error);
    };

    const rejectWithTimeout = (reason: string) => {
      if (settled) return;

      if (child.exitCode === null) {
        child.kill('SIGTERM');
        killTimeout = setTimeout(() => {
          if (child.exitCode === null) {
            child.kill('SIGKILL');
          }
        }, BUN_INSTALL_KILL_GRACE_MS);
      }

      settled = true;
      clearTimers();
      reject(
        new Error(
          `${reason} (${command}) in ${rootPath}. The process was terminated after timeout safeguards.`,
        ),
      );
    };

    child.once('spawn', () => {
      if (settled) return;
      clearTimeout(spawnTimeout);
      hardTimeout = setTimeout(() => {
        rejectWithTimeout(`bun install exceeded ${BUN_INSTALL_HARD_TIMEOUT_MS}ms`);
      }, BUN_INSTALL_HARD_TIMEOUT_MS);
    });

    child.once('error', (error) => {
      const spawnError = error as NodeJS.ErrnoException;
      const message =
        spawnError.code === 'ENOENT'
          ? `bun executable was not found in PATH while running '${command}' in ${rootPath}. Install Bun and retry.`
          : `Failed to start '${command}' in ${rootPath}: ${spawnError.message}`;
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

      if (code !== null) {
        reject(new Error(`bun install failed with code ${code} in ${rootPath}.`));
        return;
      }

      reject(new Error(`bun install terminated by signal ${signal ?? 'unknown'} in ${rootPath}.`));
    });
  });
}
