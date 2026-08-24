import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:net';
import path from 'node:path';

export async function generateExpoRouterTypesAsync(options: {
  readonly env?: Readonly<Record<string, string>>;
  readonly label: string;
  readonly projectRoot: string;
  readonly timeoutMs?: number;
}): Promise<void> {
  console.log(`\n==> ${options.label}`);
  const expoPort = await reservePortAsync();
  const output: string[] = [];
  const expoProcess = spawn('bun', ['x', 'expo', 'start', '--port', String(expoPort), '--clear'], {
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

function collectProcessOutput(
  processToCollect: ChildProcessWithoutNullStreams,
  output: string[],
): void {
  processToCollect.stdout.on('data', (chunk: Buffer) => output.push(chunk.toString('utf8')));
  processToCollect.stderr.on('data', (chunk: Buffer) => output.push(chunk.toString('utf8')));
}

async function pathExistsAsync(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false;
    throw error;
  }
}

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

async function stopProcessAsync(processToStop: ChildProcessWithoutNullStreams): Promise<void> {
  if (!processToStop.pid || processToStop.exitCode !== null) return;
  try {
    globalThis.process.kill(-processToStop.pid, 'SIGTERM');
  } catch {
    processToStop.kill('SIGTERM');
  }
  await waitForProcessExitAsync(processToStop);
}

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
