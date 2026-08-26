import { spawn } from 'node:child_process';
import { rm, stat } from 'node:fs/promises';
import { createServer } from 'node:net';
import path from 'node:path';

const projectRoot = process.cwd();
const routerTypesPath = path.join(projectRoot, '.expo', 'types', 'router.d.ts');
const port = await reservePort();
const output = [];

await rm(routerTypesPath, { force: true });
const expoProcess = spawn('expo', ['start', '--port', String(port), '--clear'], {
  cwd: projectRoot,
  detached: true,
  env: {
    ...process.env,
    BROWSER: 'none',
    CI: '1',
    EXPO_NO_TELEMETRY: '1',
    EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK: '1',
  },
});
expoProcess.stdout.on('data', (chunk) => output.push(chunk.toString('utf8')));
expoProcess.stderr.on('data', (chunk) => output.push(chunk.toString('utf8')));

try {
  await waitForRouterTypes();
  console.log(`Generated non-empty ${path.relative(projectRoot, routerTypesPath)}.`);
} finally {
  await stopProcess(expoProcess);
}

async function reservePort() {
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

async function stopProcess(processToStop) {
  if (!processToStop.pid || processToStop.exitCode !== null) return;
  try {
    process.kill(-processToStop.pid, 'SIGTERM');
  } catch {
    processToStop.kill('SIGTERM');
  }
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 5_000);
    processToStop.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function waitForRouterTypes() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 120_000) {
    try {
      const file = await stat(routerTypesPath);
      if (file.isFile() && file.size > 0) return;
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
    if (expoProcess.exitCode !== null) {
      throw new Error(
        `Expo Router type generation exited with ${expoProcess.exitCode}.\n${output.join('').slice(-8_000)}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Expo Router type generation timed out.\n${output.join('').slice(-8_000)}`);
}
