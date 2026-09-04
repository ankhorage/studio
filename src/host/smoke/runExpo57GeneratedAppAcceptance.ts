import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { AppManifest, ScreenSpec } from '@ankhorage/contracts';

import { ProjectManager } from '../orchestrator/projectManager';
import { createSmokeProjectSource } from './createSmokeProjectSource';
import { resolveAppOwnedExpoCliAsync } from './resolveAppOwnedExpoCliAsync';
import { runAcceptanceCommandAsync } from './runAcceptanceCommandAsync';

const CAMERA_DEPENDENCIES = ['@ankhorage/permissions', 'expo-camera'] as const;
const COMMAND_TIMEOUT_MS = 300_000;

/***
 * Create a generated standalone Expo 57 app, perform a cold frozen install and full static/native validation, and assert that acceptance leaves its lockfile unchanged.
 * @todo Move this generated-app acceptance orchestration from production src/host/smoke to test/smoke.
 */
export async function runExpo57GeneratedAppAcceptanceAsync(): Promise<void> {
  const workspaceRoot = await mkdtemp(path.join('/tmp', 'ankh-expo57-acceptance-'));

  try {
    const projectRoot = await createGeneratedProjectAsync(workspaceRoot);
    await rm(path.join(workspaceRoot, 'package.json'));
    const lockfileDigest = await createProjectLockfileAsync(projectRoot);
    await runAcceptanceChecksAsync(projectRoot);
    const finalDigest = hash(await readFile(path.join(projectRoot, 'bun.lock')));
    if (finalDigest !== lockfileDigest) {
      throw new Error('Generated app acceptance mutated its frozen lockfile.');
    }
  } finally {
    await rm(workspaceRoot, { force: true, recursive: true });
  }
}

/*** Assert that the camera-free generated app neither declares nor transitively installs camera capability dependencies. */
async function assertCameraFreeInstalledGraphAsync(projectRoot: string): Promise<void> {
  const packageJson = JSON.parse(
    await readFile(path.join(projectRoot, 'package.json'), 'utf8'),
  ) as { readonly dependencies?: Record<string, string> };
  const installedGraph = await runAcceptanceCommandAsync({
    args: ['pm', 'ls', '--all'],
    captureOutput: true,
    command: 'bun',
    cwd: projectRoot,
    label: 'Inspect camera-free installed dependency graph',
    timeoutMs: COMMAND_TIMEOUT_MS,
  });

  for (const dependency of CAMERA_DEPENDENCIES) {
    if (Object.hasOwn(packageJson.dependencies ?? {}, dependency)) {
      throw new Error(`Camera-free generated package unexpectedly declares ${dependency}.`);
    }
    if (installedGraph.includes(dependency)) {
      throw new Error(
        `Camera-free installed dependency graph unexpectedly contains ${dependency}.`,
      );
    }
  }
}

/*** Create the minimal standalone acceptance project and replace its initial manifest screen with a camera-free generated screen. */
async function createGeneratedProjectAsync(workspaceRoot: string): Promise<string> {
  await mkdir(path.join(workspaceRoot, 'apps'), { recursive: true });
  await writeFile(
    path.join(workspaceRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: '@ankhorage/expo57-generated-app-acceptance',
        packageManager: 'bun@1.3.14',
        private: true,
        workspaces: ['apps/*'],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  const projectManager = new ProjectManager(workspaceRoot);
  const created = await projectManager.createProject(
    'Expo 57 Generated App Acceptance',
    createSmokeProjectSource(),
    undefined,
    { includeStudio: false },
  );
  const manifest = await projectManager.getProjectManifest(created.id);
  const screen = resolveAcceptanceScreen(manifest);
  const { auth: _auth, ...infra } = manifest.infra;
  const acceptanceScreen: ScreenSpec = {
    ...screen,
    root: {
      id: 'expo57-acceptance-screen',
      type: 'Screen',
      props: {},
    },
  };

  await projectManager.saveProjectManifest({
    projectId: created.id,
    manifest: {
      ...manifest,
      infra,
      navigator: {
        type: 'stack',
        initialRouteName: 'index',
        routes: [{ name: 'index', screenId: acceptanceScreen.id }],
      },
      screens: { [acceptanceScreen.id]: acceptanceScreen },
    },
    mutations: [],
  });

  return created.path;
}

/*** Create the generated app-owned cross-platform Bun lockfile and return its content fingerprint. */
async function createProjectLockfileAsync(projectRoot: string): Promise<string> {
  await runAcceptanceCommandAsync({
    args: ['install', '--lockfile-only', '--os=*', '--cpu=*'],
    command: 'bun',
    cwd: projectRoot,
    label: 'Create generated app-owned lockfile',
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
  return hash(await readFile(path.join(projectRoot, 'bun.lock')));
}

/***
 * Compute a SHA-256 hex digest for byte content.
 * @utility @ankhorage/utility/crypto
 */
function hash(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

/*** Resolve the manifest screen routed by the navigator's current initial route for acceptance mutation. */
function resolveAcceptanceScreen(manifest: AppManifest): ScreenSpec {
  const { navigator, screens } = manifest;
  const initialRoute = navigator.routes.find((route) => route.name === navigator.initialRouteName);
  const screen = initialRoute?.screenId ? screens[initialRoute.screenId] : undefined;
  if (!screen) throw new Error('Generated acceptance template has no initial routed screen.');
  return screen;
}

/*** Run cold installation, graph checks, lint, Expo compatibility/Doctor, typecheck, platform exports and clean native prebuild for the generated app. */
async function runAcceptanceChecksAsync(projectRoot: string): Promise<void> {
  await runAcceptanceCommandAsync({
    args: ['install', '--frozen-lockfile'],
    command: 'bun',
    cwd: projectRoot,
    label: 'Cold frozen install',
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
  await assertCameraFreeInstalledGraphAsync(projectRoot);
  const expoCli = await resolveAppOwnedExpoCliAsync(projectRoot);

  const commands = [
    { args: ['run', 'lint'], command: 'bun', cwd: projectRoot, label: 'Generated app lint' },
    {
      args: ['install', '--check'],
      command: expoCli,
      cwd: projectRoot,
      label: 'Expo dependency compatibility',
    },
    { args: ['run', 'doctor'], command: 'bun', cwd: projectRoot, label: 'Expo Doctor' },
    { args: ['run', 'typecheck'], command: 'bun', cwd: projectRoot, label: 'TypeScript 6' },
    {
      args: ['export', '--platform', 'web', '--output-dir', 'dist-web', '--clear'],
      command: expoCli,
      cwd: projectRoot,
      label: 'Static Web export',
    },
    {
      args: ['export', '--platform', 'android', '--output-dir', 'dist-android', '--clear'],
      command: expoCli,
      cwd: projectRoot,
      label: 'Android JavaScript export',
    },
    {
      args: ['export', '--platform', 'ios', '--output-dir', 'dist-ios', '--clear'],
      command: expoCli,
      cwd: projectRoot,
      label: 'iOS JavaScript export',
    },
    {
      args: ['prebuild', '--clean', '--no-install'],
      command: expoCli,
      cwd: projectRoot,
      label: 'Clean CNG prebuild',
    },
  ];

  for (const command of commands) {
    await runAcceptanceCommandAsync({
      ...command,
      env: { __UNSAFE_EXPO_HOME_DIRECTORY: path.join(projectRoot, '.ankh', 'expo-home') },
      timeoutMs: COMMAND_TIMEOUT_MS,
    });
  }
}
