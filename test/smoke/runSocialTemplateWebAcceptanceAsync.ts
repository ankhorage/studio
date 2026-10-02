import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { reserveTcpPort } from '@ankhorage/utility/node/net';

import { startStudioHostServer } from '../../src/host/http/server';
import { ProjectManager } from '../../src/host/orchestrator/projectManager';
import { getProjectTemplateSource } from '../../src/host/templates';
import { assertNoBrowserErrors } from './assertNoBrowserErrors';
import { ChromeNavigationSession } from './ChromeNavigationSession';
import { resolveAppOwnedExpoCliAsync } from './resolveAppOwnedExpoCliAsync';
import { runAcceptanceCommandAsync } from './runAcceptanceCommandAsync';

const HTTP_TIMEOUT_MS = 120_000;
const COMMAND_TIMEOUT_MS = 180_000;

/***
 * Generate the released Close social template through Studio and prove its Studio-enabled Expo Web app boots and renders the root social screen.
 */
export async function runSocialTemplateWebAcceptanceAsync(): Promise<void> {
  const workspaceRoot = await mkdtemp(path.join('/tmp', 'ankh-social-template-web-'));
  let studioHost: Awaited<ReturnType<typeof startStudioHostServer>> | null = null;
  let expoProcess: ChildProcessWithoutNullStreams | null = null;
  let chrome: ChromeNavigationSession | null = null;

  try {
    await createWorkspaceAsync(workspaceRoot);
    const manager = new ProjectManager(workspaceRoot);
    const source = await getProjectTemplateSource({
      category: 'social_community',
      slug: 'chat',
    });
    const project = await manager.createProject('Close Social Web Acceptance', source, undefined, {
      includeStudio: true,
    });

    await installGeneratedProjectAsync(project.path);

    const studioHostPort = await reserveTcpPort('Close social Studio host');
    studioHost = await startStudioHostServer({
      host: '127.0.0.1',
      port: studioHostPort,
      projectRoot: workspaceRoot,
    });

    const expoPort = await reserveTcpPort('Close social Expo Web');
    const chromePort = await reserveTcpPort('Close social Chrome debug');
    const expoCli = await resolveAppOwnedExpoCliAsync(project.path);
    const output: string[] = [];
    expoProcess = spawn(expoCli, ['start', '--web', '--port', String(expoPort), '--clear'], {
      cwd: project.path,
      detached: true,
      env: {
        ...process.env,
        __UNSAFE_EXPO_HOME_DIRECTORY: path.join(project.path, '.ankh', 'expo-home'),
        BROWSER: 'none',
        CI: '1',
        EXPO_NO_TELEMETRY: '1',
        EXPO_PUBLIC_ANKH_AUTH_DISABLE_IN_DEV: 'true',
        EXPO_PUBLIC_API_URL: `http://127.0.0.1:${studioHostPort}/api`,
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-public-anon-key',
        EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
        EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK: '1',
        NODE_ENV: 'development',
      },
    });
    collectProcessOutput(expoProcess, output);

    const rootUrl = `http://127.0.0.1:${expoPort}`;
    await waitForExpoHttpAsync(rootUrl, expoProcess, output);
    chrome = await ChromeNavigationSession.createAsync(chromePort);
    await chrome.navigateAsync(rootUrl);
    await chrome.waitForLocationAsync({ pathname: '/' });
    await chrome.waitForBodyTextAsync('Friends');
    assertNoBrowserErrors(chrome.errors, 'generated Close social template');
  } finally {
    chrome?.close();
    if (expoProcess) stopProcess(expoProcess);
    await studioHost?.close();
    await rm(workspaceRoot, { force: true, recursive: true });
  }
}

/*** Create the isolated temporary Studio workspace used by the Close generated-app acceptance. */
async function createWorkspaceAsync(workspaceRoot: string): Promise<void> {
  await mkdir(path.join(workspaceRoot, 'apps'), { recursive: true });
  await writeFile(
    path.join(workspaceRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: '@ankhorage/social-template-web-acceptance',
        packageManager: 'bun@1.4.2',
        private: true,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

/*** Create and verify the generated app's own frozen Bun dependency graph before launching Expo. */
async function installGeneratedProjectAsync(projectRoot: string): Promise<void> {
  await runAcceptanceCommandAsync({
    args: ['install', '--lockfile-only', '--os=*', '--cpu=*'],
    command: 'bun',
    cwd: projectRoot,
    label: 'Close social create app-owned lockfile',
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
  await rm(path.join(projectRoot, 'node_modules'), { force: true, recursive: true });
  await runAcceptanceCommandAsync({
    args: ['install', '--frozen-lockfile'],
    command: 'bun',
    cwd: projectRoot,
    label: 'Close social cold frozen app install',
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
}

/*** Wait for Expo Web to become reachable and fail immediately with process diagnostics if Metro exits. */
async function waitForExpoHttpAsync(
  url: string,
  expoProcess: ChildProcessWithoutNullStreams,
  output: readonly string[],
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < HTTP_TIMEOUT_MS) {
    if (expoProcess.exitCode !== null || expoProcess.signalCode !== null) {
      throw new Error(
        `Close social Expo Web exited before ${url} became reachable.\n${output.join('').slice(-12_000)}`,
      );
    }

    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      await Bun.sleep(500);
    }
  }

  throw new Error(
    `Timed out waiting for generated Close social Expo Web at ${url}.\n${output.join('').slice(-12_000)}`,
  );
}

/*** Collect UTF-8 stdout and stderr from the generated app's Expo process for startup diagnostics. */
function collectProcessOutput(
  processToCollect: ChildProcessWithoutNullStreams,
  output: string[],
): void {
  processToCollect.stdout.on('data', (chunk: Buffer) => output.push(chunk.toString('utf8')));
  processToCollect.stderr.on('data', (chunk: Buffer) => output.push(chunk.toString('utf8')));
}

/*** Stop the detached generated-app process group without leaving Metro descendants behind. */
function stopProcess(processToStop: ChildProcessWithoutNullStreams): void {
  if (!processToStop.pid) return;
  try {
    globalThis.process.kill(-processToStop.pid, 'SIGTERM');
  } catch {
    processToStop.kill('SIGTERM');
  }
}
