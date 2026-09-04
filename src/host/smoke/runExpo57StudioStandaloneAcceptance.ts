import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';

import { startStudioHostServerWithSecrets } from '../http/serverWithSecrets';
import { assertExpo57StudioNativePrebuildAsync } from './assertExpo57StudioNativePrebuildAsync';
import { assertExpo57StudioStandaloneContractAsync } from './assertExpo57StudioStandaloneContractAsync';
import { createExpo57StudioHostFixtureAsync } from './createExpo57StudioHostFixtureAsync';
import { createExpo57StudioStandaloneFixtureAsync } from './createExpo57StudioStandaloneFixtureAsync';
import { runAcceptanceCommandAsync } from './runAcceptanceCommandAsync';
import { runExpo57StudioStandaloneDevelopmentWebSmokeAsync } from './runExpo57StudioStandaloneDevelopmentWebSmokeAsync';
import { runExpo57StudioStandaloneStaticWebSmokeAsync } from './runExpo57StudioStandaloneStaticWebSmokeAsync';

const COMMAND_TIMEOUT_MS = 300_000;
const ACCEPTANCE_CATEGORY = 'developer_tools' as const;
const ACCEPTANCE_CATEGORY_LABEL = 'Developer Tools';

export async function runExpo57StudioStandaloneAcceptance(
  options: {
    readonly keepFixture?: boolean;
  } = {},
): Promise<void> {
  const repositoryRoot = process.cwd();
  const fixtureRoot = await mkdtemp(path.join('/tmp', 'ankh-studio-standalone-'));
  const hostWorkspaceRoot = await mkdtemp(path.join('/tmp', 'ankh-studio-host-'));
  const cacheRoot = await mkdtemp(path.join('/tmp', 'ankh-studio-cache-'));
  let host: Awaited<ReturnType<typeof startStudioHostServerWithSecrets>> | null = null;

  try {
    await createExpo57StudioStandaloneFixtureAsync({ fixtureRoot, repositoryRoot });
    await assertExpo57StudioStandaloneContractAsync({
      fixtureRoot,
      installed: false,
      repositoryRoot,
    });
    const lockfileDigest = await createLockfileAndInstallAsync(fixtureRoot, cacheRoot);
    await assertExpo57StudioStandaloneContractAsync({
      fixtureRoot,
      installed: true,
      repositoryRoot,
    });
    await runAppOwnedQualityChecksAsync(fixtureRoot, cacheRoot);
    await assertExpo57StudioStandaloneContractAsync({
      fixtureRoot,
      installed: true,
      repositoryRoot,
    });

    await createExpo57StudioHostFixtureAsync(hostWorkspaceRoot, ACCEPTANCE_CATEGORY);
    const hostPort = 3000;
    host = await startStudioHostServerWithSecrets({
      host: '127.0.0.1',
      port: hostPort,
      projectRoot: hostWorkspaceRoot,
    });
    const apiUrl = `http://127.0.0.1:${hostPort}/api`;
    await runExpo57StudioStandaloneDevelopmentWebSmokeAsync({
      apiUrl,
      categoryId: ACCEPTANCE_CATEGORY,
      categoryLabel: ACCEPTANCE_CATEGORY_LABEL,
      fixtureRoot,
    });
    await runStaticAndNativeOutputChecksAsync({ apiUrl, cacheRoot, fixtureRoot });
    await assertExpo57StudioNativePrebuildAsync(fixtureRoot);
    await assertLockfileUnchangedAsync(fixtureRoot, lockfileDigest);

    console.log(`Standalone Studio acceptance passed at ${fixtureRoot}.`);
  } finally {
    await host?.close();
    await Promise.all([
      rm(cacheRoot, { force: true, recursive: true }),
      rm(hostWorkspaceRoot, { force: true, recursive: true }),
      ...(options.keepFixture ? [] : [rm(fixtureRoot, { force: true, recursive: true })]),
    ]);
    if (options.keepFixture) console.log(`Retained standalone Studio fixture: ${fixtureRoot}`);
  }
}

async function assertLockfileUnchangedAsync(
  fixtureRoot: string,
  expectedDigest: string,
): Promise<void> {
  const after = hash(await readFile(path.join(fixtureRoot, 'bun.lock')));
  if (expectedDigest !== after)
    throw new Error('Standalone acceptance mutated its frozen lockfile.');
}

async function createLockfileAndInstallAsync(
  fixtureRoot: string,
  cacheRoot: string,
): Promise<string> {
  const environment = createCommandEnvironment(cacheRoot);
  await runAcceptanceCommandAsync({
    args: ['install', '--lockfile-only', '--os=*', '--cpu=*'],
    command: 'bun',
    cwd: fixtureRoot,
    env: environment,
    label: 'Create standalone Studio registry lockfile',
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
  await rm(path.join(fixtureRoot, 'node_modules'), { force: true, recursive: true });
  const lockfile = await readFile(path.join(fixtureRoot, 'bun.lock'));
  const lockfileDigest = hash(lockfile);
  await runAcceptanceCommandAsync({
    args: ['install', '--frozen-lockfile'],
    command: 'bun',
    cwd: fixtureRoot,
    env: environment,
    label: 'Cold standalone Studio frozen install',
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
  await assertLockfileUnchangedAsync(fixtureRoot, lockfileDigest);
  return lockfileDigest;
}

function createCommandEnvironment(cacheRoot: string): Readonly<Record<string, string>> {
  return {
    __UNSAFE_EXPO_HOME_DIRECTORY: path.join(cacheRoot, 'expo-home'),
    BUN_INSTALL_CACHE_DIR: path.join(cacheRoot, 'bun-install'),
    EXPO_NO_TELEMETRY: '1',
    EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK: '1',
  };
}

function hash(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

async function runAppOwnedQualityChecksAsync(
  fixtureRoot: string,
  cacheRoot: string,
): Promise<void> {
  const commands = [
    ['platform:check', 'Released Expo platform contract'],
    ['type-check', 'Router types followed by TypeScript 6'],
    ['lint', 'Standalone Studio app lint'],
    ['format:check', 'Standalone Studio app format'],
    ['expo:check', 'Expo dependency compatibility'],
    ['doctor', 'Expo Doctor'],
    ['compiler:healthcheck', 'React Compiler healthcheck'],
  ] as const;
  for (const [script, label] of commands) {
    await runAcceptanceCommandAsync({
      args: ['run', script],
      command: 'bun',
      cwd: fixtureRoot,
      env: createCommandEnvironment(cacheRoot),
      label,
      timeoutMs: COMMAND_TIMEOUT_MS,
    });
  }
}

async function runStaticAndNativeOutputChecksAsync(options: {
  readonly apiUrl: string;
  readonly cacheRoot: string;
  readonly fixtureRoot: string;
}): Promise<void> {
  const environment = {
    ...createCommandEnvironment(options.cacheRoot),
    EXPO_PUBLIC_API_URL: options.apiUrl,
  };
  const commands = [
    ['export:web', 'Standalone Studio static Web export'],
    ['export:android', 'Standalone Studio Android JavaScript export'],
    ['export:ios', 'Standalone Studio iOS JavaScript export'],
  ] as const;
  for (const [script, label] of commands) {
    await runAcceptanceCommandAsync({
      args: ['run', script, '--', '--clear'],
      command: 'bun',
      cwd: options.fixtureRoot,
      env: environment,
      label,
      timeoutMs: COMMAND_TIMEOUT_MS,
    });
    if (script === 'export:web') {
      await runExpo57StudioStandaloneStaticWebSmokeAsync(options.fixtureRoot);
    }
  }
  await runAcceptanceCommandAsync({
    args: ['run', 'prebuild'],
    command: 'bun',
    cwd: options.fixtureRoot,
    env: environment,
    label: 'Standalone Studio clean CNG prebuild',
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
}
