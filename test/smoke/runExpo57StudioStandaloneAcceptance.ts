import { createHash } from 'node:crypto';
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import path from 'node:path';

import { startStudioHostServerWithSecrets } from '../../src/host/http/serverWithSecrets';
import { reserveTcpPort } from '@ankhorage/utility/node/net';
import { assertExpo57StudioNativePrebuildAsync } from './assertExpo57StudioNativePrebuildAsync';
import { assertExpo57StudioReaderFreeRuntimeAsync } from './assertExpo57StudioReaderFreeRuntimeAsync';
import {
  assertExpo57StudioStandaloneContractAsync,
  type StudioStandalonePackageSource,
} from './assertExpo57StudioStandaloneContractAsync';
import { createExpo57StudioHostFixtureAsync } from './createExpo57StudioHostFixtureAsync';
import { createExpo57StudioStandaloneFixtureAsync } from './createExpo57StudioStandaloneFixtureAsync';
import { runAcceptanceCommandAsync } from './runAcceptanceCommandAsync';
import { runExpo57StudioStandaloneDevelopmentWebSmokeAsync } from './runExpo57StudioStandaloneDevelopmentWebSmokeAsync';
import { runExpo57StudioStandaloneStaticWebSmokeAsync } from './runExpo57StudioStandaloneStaticWebSmokeAsync';

const COMMAND_TIMEOUT_MS = 300_000;
const ACCEPTANCE_CATEGORY = 'developer_tools' as const;
const ACCEPTANCE_CATEGORY_LABEL = 'Developer Tools';

/***
 * Build and install an isolated standalone Studio fixture, exercise development/static/native output against a real local host, and assert checkout independence plus lockfile stability.
 */
export async function runExpo57StudioStandaloneAcceptance(
  options: {
    readonly keepFixture?: boolean;
    readonly publishedStudioVersion?: string;
  } = {},
): Promise<void> {
  const repositoryRoot = process.cwd();
  const fixtureRoot = await mkdtemp(path.join('/tmp', 'ankh-studio-standalone-'));
  const hostWorkspaceRoot = await mkdtemp(path.join('/tmp', 'ankh-studio-host-'));
  const cacheRoot = await mkdtemp(path.join('/tmp', 'ankh-studio-cache-'));
  const artifactRoot = await mkdtemp(path.join('/tmp', 'ankh-studio-artifact-'));
  let host: Awaited<ReturnType<typeof startStudioHostServerWithSecrets>> | null = null;

  try {
    const studioSource = await resolveStudioSourceAsync({
      artifactRoot,
      publishedStudioVersion: options.publishedStudioVersion,
      repositoryRoot,
    });
    await createExpo57StudioStandaloneFixtureAsync({
      fixtureRoot,
      repositoryRoot,
      studioSpecifier:
        studioSource.kind === 'packed' ? `file:${studioSource.tarballPath}` : studioSource.version,
    });
    if (studioSource.kind === 'packed') {
      await createCandidateLockfileAsync(fixtureRoot, cacheRoot);
    }
    await assertExpo57StudioStandaloneContractAsync({
      fixtureRoot,
      installed: false,
      repositoryRoot,
      studioSource,
    });
    const lockfileDigest = await createLockfileAndInstallAsync(fixtureRoot, cacheRoot);
    await assertExpo57StudioStandaloneContractAsync({
      fixtureRoot,
      installed: true,
      repositoryRoot,
      studioSource,
    });
    await runAppOwnedQualityChecksAsync(fixtureRoot, cacheRoot, studioSource);
    await assertExpo57StudioStandaloneContractAsync({
      fixtureRoot,
      installed: true,
      repositoryRoot,
      studioSource,
    });

    await createExpo57StudioHostFixtureAsync(hostWorkspaceRoot, ACCEPTANCE_CATEGORY);
    const hostPort = await reserveTcpPort('Standalone Studio host');
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

    console.log(
      studioSource.kind === 'packed'
        ? `Packed candidate ${studioSource.revision} Studio acceptance passed at ${fixtureRoot}.`
        : `Published registry Studio acceptance passed at ${fixtureRoot}.`,
    );
  } finally {
    await host?.close();
    await Promise.all([
      rm(cacheRoot, { force: true, recursive: true }),
      rm(artifactRoot, { force: true, recursive: true }),
      rm(hostWorkspaceRoot, { force: true, recursive: true }),
      ...(options.keepFixture ? [] : [rm(fixtureRoot, { force: true, recursive: true })]),
    ]);
    if (options.keepFixture) console.log(`Retained standalone Studio fixture: ${fixtureRoot}`);
  }
}

/*** Resolve a packed current-HEAD candidate for PR acceptance or an exact npm version for post-release acceptance. */
async function resolveStudioSourceAsync(options: {
  readonly artifactRoot: string;
  readonly publishedStudioVersion: string | undefined;
  readonly repositoryRoot: string;
}): Promise<StudioStandalonePackageSource> {
  if (options.publishedStudioVersion !== undefined) {
    if (!/^\d+\.\d+\.\d+$/u.test(options.publishedStudioVersion)) {
      throw new Error(
        `Published Studio version must be exact, received ${options.publishedStudioVersion}.`,
      );
    }
    return { kind: 'published', version: options.publishedStudioVersion };
  }
  const packageJson = JSON.parse(
    await readFile(path.join(options.repositoryRoot, 'package.json'), 'utf8'),
  ) as { readonly name?: string; readonly version?: string };
  if (packageJson.name !== '@ankhorage/studio' || typeof packageJson.version !== 'string') {
    throw new Error('Current Studio candidate has invalid package metadata.');
  }
  const tarballPath = path.join(options.artifactRoot, 'studio-candidate.tgz');
  const revision = (
    await runAcceptanceCommandAsync({
      args: ['rev-parse', 'HEAD'],
      captureOutput: true,
      command: 'git',
      cwd: options.repositoryRoot,
      label: 'Resolve packed Studio candidate revision',
      timeoutMs: COMMAND_TIMEOUT_MS,
    })
  ).trim();
  if (!/^[0-9a-f]{40}$/u.test(revision)) {
    throw new Error(`Packed Studio candidate revision is not a Git SHA: ${revision}.`);
  }
  await runAcceptanceCommandAsync({
    args: ['run', 'build'],
    command: 'bun',
    cwd: options.repositoryRoot,
    label: 'Build current Studio candidate',
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
  await runAcceptanceCommandAsync({
    args: ['pm', 'pack', '--filename', tarballPath, '--ignore-scripts', '--quiet'],
    command: 'bun',
    cwd: options.repositoryRoot,
    label: 'Pack current Studio candidate',
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
  const integrity = await getCandidateArtifactIntegrityAsync(tarballPath);
  return {
    integrity,
    kind: 'packed',
    revision,
    tarballPath: await realpath(tarballPath),
    version: packageJson.version,
  };
}

/*** Create the fixture-owned lockfile for the packed candidate before proving its cold frozen installation. */
async function createCandidateLockfileAsync(fixtureRoot: string, cacheRoot: string): Promise<void> {
  await runAcceptanceCommandAsync({
    args: ['install', '--lockfile-only'],
    command: 'bun',
    cwd: fixtureRoot,
    env: createCommandEnvironment(cacheRoot),
    label: 'Resolve packed Studio candidate fixture lockfile',
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
}

/*** Reject a missing or empty candidate artifact before it can become an acceptance dependency. */
async function getCandidateArtifactIntegrityAsync(tarballPath: string): Promise<string> {
  const artifact = await readFile(tarballPath);
  if (artifact.byteLength === 0) throw new Error('Packed Studio candidate artifact is empty.');
  return `sha512-${createHash('sha512').update(artifact).digest('base64')}`;
}

/*** Assert that the standalone fixture's Bun lockfile still matches the expected content digest. */
async function assertLockfileUnchangedAsync(
  fixtureRoot: string,
  expectedDigest: string,
): Promise<void> {
  const after = hash(await readFile(path.join(fixtureRoot, 'bun.lock')));
  if (expectedDigest !== after)
    throw new Error('Standalone acceptance mutated its frozen lockfile.');
}

/*** Perform a cold frozen install from the app-owned lockfile, assert stability and return its digest. */
async function createLockfileAndInstallAsync(
  fixtureRoot: string,
  cacheRoot: string,
): Promise<string> {
  const environment = createCommandEnvironment(cacheRoot);
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

/*** Build the isolated Bun/Expo cache environment used by standalone acceptance commands. */
function createCommandEnvironment(cacheRoot: string): Readonly<Record<string, string>> {
  return {
    __UNSAFE_EXPO_HOME_DIRECTORY: path.join(cacheRoot, 'expo-home'),
    BUN_INSTALL_CACHE_DIR: path.join(cacheRoot, 'bun-install'),
    EXPO_NO_TELEMETRY: '1',
    EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK: '1',
  };
}

/***
 * Compute a SHA-256 hex digest for byte content.
 * Utility candidate: @ankhorage/utility/crypto
 */
function hash(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

/*** Run the standalone app-owned platform, type, lint, format, Expo Doctor and React Compiler quality gates. */
async function runAppOwnedQualityChecksAsync(
  fixtureRoot: string,
  cacheRoot: string,
  studioSource: StudioStandalonePackageSource,
): Promise<void> {
  const commands = [
    ['platform:check', 'Released Expo platform contract'],
    ['typecheck', 'Router types followed by TypeScript 6'],
    ['knip:check', 'Standalone Studio app Knip'],
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
      env: {
        ...createCommandEnvironment(cacheRoot),
        ...(studioSource.kind === 'packed'
          ? { STUDIO_CANDIDATE_TARBALL: studioSource.tarballPath }
          : {}),
      },
      label,
      timeoutMs: COMMAND_TIMEOUT_MS,
    });
  }
}

/*** Run static Web, Android and iOS exports plus served static-Web smoke and clean native prebuild for the standalone fixture. */
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
  await assertExpo57StudioReaderFreeRuntimeAsync(options.fixtureRoot);
  await runAcceptanceCommandAsync({
    args: ['run', 'prebuild'],
    command: 'bun',
    cwd: options.fixtureRoot,
    env: environment,
    label: 'Standalone Studio clean CNG prebuild',
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
}
