import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { AppManifest, ScreenSpec } from '@ankhorage/contracts';

import { ProjectManager } from '../orchestrator/projectManager';
import { assertReactNativeOwnerGraphAsync } from './assertReactNativeOwnerGraphAsync';
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
  const relocatedProjectRoot = await mkdtemp(path.join('/tmp', 'ankh-expo57-relocated-'));

  try {
    const projectRoot = await createGeneratedProjectAsync(workspaceRoot);
    await assertParentOnlyDependencyCannotBundleAsync(workspaceRoot, projectRoot);
    await copyRelocatedProjectAsync(projectRoot, relocatedProjectRoot);
    const lockfileDigest = hash(await readFile(path.join(relocatedProjectRoot, 'bun.lock')));
    await runAcceptanceChecksAsync(relocatedProjectRoot);
    await assertStaleLockfileFailsAsync(relocatedProjectRoot);
    const finalDigest = hash(await readFile(path.join(relocatedProjectRoot, 'bun.lock')));
    if (finalDigest !== lockfileDigest) {
      throw new Error('Generated app acceptance mutated its frozen lockfile.');
    }
  } finally {
    await Promise.all([
      rm(workspaceRoot, { force: true, recursive: true }),
      rm(relocatedProjectRoot, { force: true, recursive: true }),
    ]);
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

/*** Assert the generated app owns one physical Surface runtime so React context providers and consumers share identity. */
async function assertGeneratedAppOwnerGraphAsync(projectRoot: string): Promise<void> {
  const packageJson = JSON.parse(
    await readFile(path.join(projectRoot, 'package.json'), 'utf8'),
  ) as { readonly dependencies?: Readonly<Record<string, string>> };
  const reactNativeVersion = packageJson.dependencies?.['react-native'];
  if (!reactNativeVersion) {
    throw new Error('Generated app does not declare its React Native runtime version.');
  }
  await assertReactNativeOwnerGraphAsync({
    installationRoot: projectRoot,
    reactNativeVersion,
    requiredOwnerRanges: {},
    singletonOwnerPackages: ['@ankhorage/surface'],
  });
}

/*** Create the minimal standalone acceptance project and replace its initial manifest screen with a camera-free generated screen. */
async function createGeneratedProjectAsync(workspaceRoot: string): Promise<string> {
  await mkdir(path.join(workspaceRoot, 'apps'), { recursive: true });
  await writeFile(
    path.join(workspaceRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: '@ankhorage/expo57-generated-app-acceptance',
        packageManager: 'bun@1.4.2',
        private: true,
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

/*** Run cold installation, graph checks, lint, Expo compatibility, typecheck, platform exports and clean native prebuild for the generated app. */
async function runAcceptanceChecksAsync(projectRoot: string): Promise<void> {
  await runAcceptanceCommandAsync({
    args: ['install', '--frozen-lockfile'],
    command: 'bun',
    cwd: projectRoot,
    label: 'Cold frozen install',
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
  await assertCameraFreeInstalledGraphAsync(projectRoot);
  await assertGeneratedAppOwnerGraphAsync(projectRoot);
  const expoCli = await resolveAppOwnedExpoCliAsync(projectRoot);
  const expoDoctorCli = path.join(
    projectRoot,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'expo-doctor.cmd' : 'expo-doctor',
  );

  const commands = [
    { args: ['run', 'lint'], command: 'bun', cwd: projectRoot, label: 'Generated app lint' },
    {
      args: ['run', 'format:check'],
      command: 'bun',
      cwd: projectRoot,
      label: 'Generated app format',
    },
    {
      args: ['run', 'knip:check'],
      command: 'bun',
      cwd: projectRoot,
      label: 'Generated app Knip',
    },
    {
      args: ['install', '--check'],
      command: expoCli,
      cwd: projectRoot,
      label: 'Expo dependency compatibility',
    },
    { args: [], command: expoDoctorCli, cwd: projectRoot, label: 'Expo Doctor' },
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

/*** Copy a generated app without installed/transient output to an unrelated standalone root. */
async function copyRelocatedProjectAsync(sourceRoot: string, targetRoot: string): Promise<void> {
  await cp(sourceRoot, targetRoot, {
    recursive: true,
    filter: (source) => {
      const relativePath = path.relative(sourceRoot, source);
      const [firstSegment] = relativePath.split(path.sep);
      return !['node_modules', '.expo', 'dist-web', 'dist-android', 'dist-ios'].includes(
        firstSegment ?? '',
      );
    },
  });
}

/*** Prove Metro cannot satisfy a generated-app import from an ancestor-only package installation. */
async function assertParentOnlyDependencyCannotBundleAsync(
  workspaceRoot: string,
  projectRoot: string,
): Promise<void> {
  const dependencyRoot = path.join(workspaceRoot, 'node_modules', 'parent-only-dependency');
  const probePath = path.join(projectRoot, 'src', 'app', 'parent-only-probe.tsx');
  await mkdir(dependencyRoot, { recursive: true });
  await Promise.all([
    writeFile(
      path.join(dependencyRoot, 'package.json'),
      `${JSON.stringify({ name: 'parent-only-dependency', main: 'index.js', version: '1.0.0' })}\n`,
      'utf8',
    ),
    writeFile(path.join(dependencyRoot, 'index.js'), "module.exports = 'ancestor';\n", 'utf8'),
    writeFile(
      probePath,
      `import { Text } from 'react-native';\nimport parentOnly from 'parent-only-dependency';\n\nexport default function ParentOnlyProbe() {\n  return <Text>{parentOnly}</Text>;\n}\n`,
      'utf8',
    ),
  ]);

  const expoCli = await resolveAppOwnedExpoCliAsync(projectRoot);
  let failed = false;
  try {
    await runAcceptanceCommandAsync({
      args: ['export', '--platform', 'web', '--output-dir', 'dist-parent-probe', '--clear'],
      command: expoCli,
      cwd: projectRoot,
      label: 'Reject parent-only Metro dependency',
      timeoutMs: COMMAND_TIMEOUT_MS,
    });
  } catch {
    failed = true;
  } finally {
    await Promise.all([
      rm(probePath, { force: true }),
      rm(path.join(projectRoot, 'dist-parent-probe'), { force: true, recursive: true }),
    ]);
  }
  if (!failed) {
    throw new Error('Metro bundled a dependency available only from the Studio parent root.');
  }
}

/*** Prove a package mutation without lockfile reconciliation fails the frozen-install contract. */
async function assertStaleLockfileFailsAsync(projectRoot: string): Promise<void> {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  const originalPackageJson = await readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(originalPackageJson) as {
    dependencies?: Record<string, string>;
  };
  packageJson.dependencies = {
    ...(packageJson.dependencies ?? {}),
    'stale-lockfile-probe': '1.0.0',
  };
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
  let failed = false;
  try {
    await runAcceptanceCommandAsync({
      args: ['install', '--frozen-lockfile'],
      command: 'bun',
      cwd: projectRoot,
      label: 'Reject stale generated app lockfile',
      timeoutMs: COMMAND_TIMEOUT_MS,
    });
  } catch {
    failed = true;
  } finally {
    await writeFile(packageJsonPath, originalPackageJson, 'utf8');
  }
  if (!failed) throw new Error('Frozen install accepted a stale generated app lockfile.');
}
