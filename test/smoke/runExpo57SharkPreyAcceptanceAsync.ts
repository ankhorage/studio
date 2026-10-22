import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { reserveTcpPort } from '@ankhorage/utility/node/net';

import { startStudioHostServer } from '../../src/host/http/server';
import { ProjectManager } from '../../src/host/orchestrator/projectManager';
import { getProjectTemplateSource } from '../../src/host/templates';
import { assertNoBrowserErrors } from './assertNoBrowserErrors';
import { ChromeNavigationSession } from './ChromeNavigationSession';
import { resolveAppOwnedExpoCliAsync } from './resolveAppOwnedExpoCliAsync';
import { runAcceptanceCommandAsync } from './runAcceptanceCommandAsync';

const COMMAND_TIMEOUT_MS = 300_000;
const HTTP_TIMEOUT_MS = 120_000;
const SHARKPREY_TEMPLATE = { category: 'education_learning', slug: 'sharkprey' } as const;

/***
 * Generate the released SharkPrey template with Studio, install the packed Studio candidate, and prove its untouched output passes every generated-app quality gate and boots in Chrome.
 */
export async function runExpo57SharkPreyAcceptanceAsync(): Promise<void> {
  const workspaceRoot = await mkdtemp(path.join('/tmp', 'ankh-sharkprey-acceptance-'));
  let studioHost: Awaited<ReturnType<typeof startStudioHostServer>> | null = null;
  let expoProcess: ChildProcessWithoutNullStreams | null = null;
  let chrome: ChromeNavigationSession | null = null;

  try {
    await createWorkspaceAsync(workspaceRoot);
    const manager = new ProjectManager(workspaceRoot);
    const source = await getProjectTemplateSource(SHARKPREY_TEMPLATE);
    const project = await manager.createProject('SharkPrey Acceptance', source, undefined, {
      includeStudio: true,
    });
    await runGeneratedPlatformContractAsync(project.path);
    const studioCandidate = await packCurrentStudioCandidateAsync(workspaceRoot);
    await installStudioCandidateAsync(project.path, studioCandidate);
    const lockfile = await createFrozenProjectInstallationAsync(project.path);
    await assertGeneratedModuleBoundariesAsync(project.path);
    await runGeneratedQualityGatesAsync(project.path);
    await assertUnchangedLockfileAsync(project.path, lockfile);
    await runGeneratedPlatformBuildsAsync(project.path);
    await assertUnchangedLockfileAsync(project.path, lockfile);

    const browser = await startGeneratedAppAsync({ projectRoot: project.path, workspaceRoot });
    studioHost = browser.studioHost;
    expoProcess = browser.expoProcess;
    chrome = browser.chrome;
  } finally {
    chrome?.close();
    if (expoProcess) stopProcess(expoProcess);
    await studioHost?.close();
    await rm(workspaceRoot, { force: true, recursive: true });
  }
}

/*** Create the isolated parent workspace that makes the generated app prove its own dependency and lockfile ownership. */
async function createWorkspaceAsync(workspaceRoot: string): Promise<void> {
  await mkdir(path.join(workspaceRoot, 'apps'), { recursive: true });
  await writeFile(
    path.join(workspaceRoot, 'package.json'),
    `${JSON.stringify({ name: '@ankhorage/sharkprey-acceptance', packageManager: 'bun@1.4.2', private: true }, null, 2)}\n`,
    'utf8',
  );
}

/*** Build and package the current checkout so the generated app exercises the candidate instead of a previously released Studio version. */
async function packCurrentStudioCandidateAsync(workspaceRoot: string): Promise<string> {
  const artifactRoot = path.join(workspaceRoot, '.ankh', 'acceptance-artifacts');
  const tarballPath = path.join(artifactRoot, 'studio-candidate.tgz');
  await mkdir(artifactRoot, { recursive: true });
  await runAcceptanceCommandAsync({
    args: ['run', 'build'],
    command: 'bun',
    cwd: process.cwd(),
    label: 'Build SharkPrey Studio candidate',
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
  await runAcceptanceCommandAsync({
    args: ['pm', 'pack', '--filename', tarballPath, '--ignore-scripts', '--quiet'],
    command: 'bun',
    cwd: process.cwd(),
    label: 'Pack SharkPrey Studio candidate',
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
  return tarballPath;
}

/*** Replace only the acceptance app's Studio dependency with the explicitly packed local candidate. */
async function installStudioCandidateAsync(
  projectRoot: string,
  studioCandidate: string,
): Promise<void> {
  const packagePath = path.join(projectRoot, 'package.json');
  const packageJson = JSON.parse(await readFile(packagePath, 'utf8')) as {
    dependencies: Record<string, string>;
  };
  packageJson.dependencies['@ankhorage/studio'] = `file:${studioCandidate}`;
  await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
}

/*** Create an app-owned cross-platform lockfile, then perform the untouched app's required cold frozen installation. */
async function createFrozenProjectInstallationAsync(projectRoot: string): Promise<Uint8Array> {
  await runAcceptanceCommandAsync({
    args: ['install', '--lockfile-only', '--os=*', '--cpu=*'],
    command: 'bun',
    cwd: projectRoot,
    label: 'Create SharkPrey app lockfile',
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
  await rm(path.join(projectRoot, 'node_modules'), { force: true, recursive: true });
  await runAcceptanceCommandAsync({
    args: ['install', '--frozen-lockfile'],
    command: 'bun',
    cwd: projectRoot,
    label: 'Cold frozen SharkPrey app install',
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
  return readFile(path.join(projectRoot, 'bun.lock'));
}

/*** Assert that generator ownership creates the extracted root, Studio, and runtime shells without restoring obsolete root-layout implementation details. */
async function assertGeneratedModuleBoundariesAsync(projectRoot: string): Promise<void> {
  const generatedRoot = path.join(projectRoot, 'src', 'generated');
  const modules = await Promise.all([
    readFile(path.join(projectRoot, 'src', 'app', '_layout.tsx'), 'utf8'),
    readFile(path.join(generatedRoot, 'rootShell.tsx'), 'utf8'),
    readFile(path.join(generatedRoot, 'runtimeShell.tsx'), 'utf8'),
    readFile(path.join(generatedRoot, 'studioAppHeader.tsx'), 'utf8'),
    readFile(path.join(generatedRoot, 'studioShell.tsx'), 'utf8'),
  ]);
  const [layout, rootShell, runtimeShell, studioAppHeader, studioShell] = modules;
  for (const [name, source, required] of [
    ['root layout', layout, 'GeneratedRootShell'],
    ['root shell', rootShell, 'ExpoZoraIconFontProvider'],
    ['runtime shell', runtimeShell, 'RuntimeRendererConfigProvider'],
    ['Studio app header', studioAppHeader, 'StudioAppHeader'],
    ['Studio shell', studioShell, 'StudioAppHeader'],
  ] as const) {
    if (!source.includes(required))
      throw new Error(`Generated SharkPrey ${name} is missing ${required}.`);
  }
  if (layout.includes('useGlobalSearchParams') || layout.includes('useMemo')) {
    throw new Error(
      'Generated SharkPrey root layout restored obsolete route-search or memo dependencies.',
    );
  }
}

/*** Verify the untouched generated package declares only standalone-compatible dependency ranges before candidate installation. */
async function runGeneratedPlatformContractAsync(projectRoot: string): Promise<void> {
  await runAcceptanceCommandAsync({
    args: ['run', 'platform:check'],
    command: 'bun',
    cwd: projectRoot,
    env: expoEnvironment(projectRoot),
    label: 'SharkPrey platform:check',
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
}

/*** Run static generated-app gates without changing generated source; lint is configured to reject warnings as well as errors. */
async function runGeneratedQualityGatesAsync(projectRoot: string): Promise<void> {
  const commands = [
    ['run', 'typecheck'],
    ['run', 'lint'],
    ['run', 'format:check'],
    ['run', 'knip:check'],
    ['run', 'doctor'],
  ] as const;
  for (const args of commands) {
    await runAcceptanceCommandAsync({
      args: [...args],
      command: 'bun',
      cwd: projectRoot,
      env: expoEnvironment(projectRoot),
      label: `SharkPrey ${args[1]}`,
      timeoutMs: COMMAND_TIMEOUT_MS,
    });
  }
}

/*** Export the generated application for every JavaScript target and perform clean native project materialization. */
async function runGeneratedPlatformBuildsAsync(projectRoot: string): Promise<void> {
  const expoCli = await resolveAppOwnedExpoCliAsync(projectRoot);
  for (const args of [
    ['export', '--platform', 'web', '--output-dir', 'dist-web', '--clear'],
    ['export', '--platform', 'ios', '--output-dir', 'dist-ios', '--clear'],
    ['export', '--platform', 'android', '--output-dir', 'dist-android', '--clear'],
    ['prebuild', '--clean', '--no-install'],
  ] as const) {
    await runAcceptanceCommandAsync({
      args: [...args],
      command: expoCli,
      cwd: projectRoot,
      label: `SharkPrey Expo ${args[0]} ${args[2] ?? ''}`.trim(),
      env: expoEnvironment(projectRoot),
      timeoutMs: COMMAND_TIMEOUT_MS,
    });
  }
}

/*** Start Studio and Expo Web, then prove the initial screen and nested Headless Tabs are visible and navigable in a real Chrome process. */
async function startGeneratedAppAsync(args: {
  readonly projectRoot: string;
  readonly workspaceRoot: string;
}): Promise<{
  readonly chrome: ChromeNavigationSession;
  readonly expoProcess: ChildProcessWithoutNullStreams;
  readonly studioHost: Awaited<ReturnType<typeof startStudioHostServer>>;
}> {
  const studioPort = await reserveTcpPort('SharkPrey Studio host');
  const studioHost = await startStudioHostServer({
    host: '127.0.0.1',
    port: studioPort,
    projectRoot: args.workspaceRoot,
  });
  const expoPort = await reserveTcpPort('SharkPrey Expo Web');
  const expoCli = await resolveAppOwnedExpoCliAsync(args.projectRoot);
  const output: string[] = [];
  const expoProcess = spawn(expoCli, ['start', '--web', '--port', String(expoPort), '--clear'], {
    cwd: args.projectRoot,
    detached: true,
    env: {
      ...expoEnvironment(args.projectRoot),
      EXPO_PUBLIC_API_URL: `http://127.0.0.1:${studioPort}/api`,
    },
  });
  collectProcessOutput(expoProcess, output);
  const url = `http://127.0.0.1:${expoPort}`;
  await waitForExpoHttpAsync(url, expoProcess, output);
  const chrome = await ChromeNavigationSession.createAsync(
    await reserveTcpPort('SharkPrey Chrome debug'),
  );
  await chrome.navigateAsync(url);
  await chrome.waitForBodyTextAsync('Where are you starting?');
  await chrome.clickByRoleAndNameAsync('button', 'New to NLHE');
  await chrome.clickByRoleAndNameAsync('button', 'Start assessment');
  await chrome.waitForLocationAsync({ pathname: '/training-setup' });
  await chrome.waitForBodyTextAsync('What do you want to train?');
  await chrome.navigateAsync(`${url}/history`);
  await chrome.waitForBodyTextAsync('History');
  await chrome.waitForHydratedRoleAndNameAsync('tab', 'Train');
  await chrome.waitForHydratedRoleAndNameAsync('tab', 'History');
  assertNoBrowserErrors(chrome.errors, 'generated SharkPrey template');
  return { chrome, expoProcess, studioHost };
}

/*** Supply safe deterministic generated-app environment values for static, native, and browser acceptance. */
function expoEnvironment(projectRoot: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    __UNSAFE_EXPO_HOME_DIRECTORY: path.join(projectRoot, '.ankh', 'expo-home'),
    BROWSER: 'none',
    CI: '1',
    EXPO_NO_TELEMETRY: '1',
    EXPO_PUBLIC_ANKH_AUTH_DISABLE_IN_DEV: 'true',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sharkprey-acceptance-anon-key',
    EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
    EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK: '1',
    NODE_ENV: 'development',
  };
}

/*** Verify every acceptance phase preserved the generated app's frozen lockfile bytes. */
async function assertUnchangedLockfileAsync(
  projectRoot: string,
  expected: Uint8Array,
): Promise<void> {
  const actual = await readFile(path.join(projectRoot, 'bun.lock'));
  if (!Buffer.from(actual).equals(expected))
    throw new Error('SharkPrey acceptance mutated its frozen generated lockfile.');
}

/*** Wait for Expo Web to accept requests and include process diagnostics if Metro exits before readiness. */
async function waitForExpoHttpAsync(
  url: string,
  expoProcess: ChildProcessWithoutNullStreams,
  output: readonly string[],
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < HTTP_TIMEOUT_MS) {
    if (expoProcess.exitCode !== null || expoProcess.signalCode !== null)
      throw new Error(
        `SharkPrey Expo Web exited before ${url} became reachable.\n${output.join('').slice(-12_000)}`,
      );
    try {
      if ((await fetch(url)).status < 500) return;
    } catch {
      await Bun.sleep(500);
    }
  }
  throw new Error(
    `Timed out waiting for SharkPrey Expo Web at ${url}.\n${output.join('').slice(-12_000)}`,
  );
}

/*** Collect Expo process output so launch failures retain useful Metro diagnostics. */
function collectProcessOutput(
  processToCollect: ChildProcessWithoutNullStreams,
  output: string[],
): void {
  processToCollect.stdout.on('data', (chunk: Buffer) => output.push(chunk.toString('utf8')));
  processToCollect.stderr.on('data', (chunk: Buffer) => output.push(chunk.toString('utf8')));
}

/*** Stop the detached Expo process group and any Metro children. */
function stopProcess(processToStop: ChildProcessWithoutNullStreams): void {
  if (!processToStop.pid) return;
  try {
    globalThis.process.kill(-processToStop.pid, 'SIGTERM');
  } catch {
    processToStop.kill('SIGTERM');
  }
}
