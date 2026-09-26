import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:net';
import path from 'node:path';

import { resolveAppOwnedExpoCliAsync } from './resolveAppOwnedExpoCliAsync';

/***
 * Start an app-owned Expo process until Expo Router emits its generated route types, then tear the process down.
 * @todo Move this Expo acceptance helper out of src/host into test/smoke and consume the canonical Node utilities marked below.
 */
export async function generateExpoRouterTypesAsync(options: {
  readonly env?: Readonly<Record<string, string>>;
  readonly label: string;
  readonly projectRoot: string;
  readonly timeoutMs?: number;
}): Promise<void> {
  console.log(`\n==> ${options.label}`);
  const expoCli = await resolveAppOwnedExpoCliAsync(options.projectRoot);
  const expoPort = await reservePortAsync();
  const output: string[] = [];
  const expoProcess = spawn(expoCli, ['start', '--port', String(expoPort), '--clear'], {
    cwd: options.projectRoot,
    detached: true,
    env: {
      ...process.env,
      BROWSER: 'none',
      CI: '1',
      EXPO_NO_TELEMETRY: '1',
      ...options.env,
    },
  });
  collectProcessOutput(expoProcess, output);
  const routerTypesPath = path.join(options.projectRoot, '.expo', 'types', 'router.d.ts');
  const start = Date.now();
  const timeoutMs = options.timeoutMs ?? 120_000;

  try {
    while (Date.now() - start < timeoutMs) {
      if (await pathExistsAsync(routerTypesPath)) return;
      if (expoProcess.exitCode !== null) {
        throw new Error(
          `${options.label} exited with ${expoProcess.exitCode}.\n${output.join('').slice(-8_000)}`,
        );
      }
      await Bun.sleep(250);
    }
    throw new Error(`${options.label} timed out.\n${output.join('').slice(-8_000)}`);
  } finally {
    await stopProcessAsync(expoProcess);
  }
}

/***
 * Collect UTF-8 stdout and stderr chunks from a child process into a shared sink.
 * @utility @ankhorage/utility/node/process
 */
function collectProcessOutput(
  processToCollect: ChildProcessWithoutNullStreams,
  output: string[],
): void {
  processToCollect.stdout.on('data', (chunk: Buffer) => output.push(chunk.toString('utf8')));
  processToCollect.stderr.on('data', (chunk: Buffer) => output.push(chunk.toString('utf8')));
}

/***
 * Return whether a filesystem path exists while rethrowing non-missing filesystem failures.
 * @utility @ankhorage/utility/node/fs
 */
async function pathExistsAsync(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false;
    throw error;
  }
}

/***
 * Reserve an ephemeral loopback TCP port and release the reservation before returning it.
 * @utility @ankhorage/utility/node/net
 */
async function reservePortAsync(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (typeof address !== 'object' || address === null) {
        server.close(() => reject(new Error('Could not reserve an Expo Router type port.')));
        return;
      }
      server.close(() => resolve(address.port));
    });
  });
}

/***
 * Stop a detached child-process group with a SIGTERM/SIGKILL fallback lifecycle.
 * @utility @ankhorage/utility/node/process
 */
async function stopProcessAsync(processToStop: ChildProcessWithoutNullStreams): Promise<void> {
  if (!processToStop.pid || processToStop.exitCode !== null) return;
  try {
    globalThis.process.kill(-processToStop.pid, 'SIGTERM');
  } catch {
    processToStop.kill('SIGTERM');
  }
  await waitForProcessExitAsync(processToStop);
}

/***
 * Wait for a child process to exit, escalating to SIGKILL after the bounded grace period.
 * @utility @ankhorage/utility/node/process
 */
function waitForProcessExitAsync(processToWaitFor: ChildProcessWithoutNullStreams): Promise<void> {
  if (processToWaitFor.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      processToWaitFor.removeListener('exit', onExit);
      if (processToWaitFor.pid) {
        try {
          globalThis.process.kill(-processToWaitFor.pid, 'SIGKILL');
        } catch {
          processToWaitFor.kill('SIGKILL');
        }
      }
      resolve();
    }, 5_000);
    const onExit = () => {
      clearTimeout(timeout);
      resolve();
    };
    processToWaitFor.once('exit', onExit);
  });
}
