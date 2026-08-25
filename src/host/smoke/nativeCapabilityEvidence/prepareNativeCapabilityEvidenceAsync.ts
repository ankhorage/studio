import { createHash } from 'node:crypto';
import { access, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { generateExpoRouterTypesAsync } from '../generateExpoRouterTypesAsync';
import { runAcceptanceCommandAsync } from '../runAcceptanceCommandAsync';
import {
  NATIVE_EVIDENCE_ANDROID_SCHEME,
  NATIVE_EVIDENCE_APP_ID,
  NATIVE_EVIDENCE_IOS_SCHEME,
  NATIVE_EVIDENCE_SERVER_PORT,
  NATIVE_EVIDENCE_STUDIO_VERSION,
} from './constants';
import { createGenerationDriverSource } from './createGenerationDriverSource';
import { createNativeEvidenceClientSource } from './createNativeEvidenceClientSource';
import { createNativeEvidenceControllerSource } from './createNativeEvidenceControllerSource';
import { createNativeEvidenceRouteSource } from './createNativeEvidenceRouteSource';
import { createNativeEvidenceScenariosSource } from './createNativeEvidenceScenariosSource';
import { createNativeEvidenceScreenSource } from './createNativeEvidenceScreenSource';

const COMMAND_TIMEOUT_MS = 240_000;
const EXPECTED_GENERATED_OWNER_VERSIONS = {
  '@ankhorage/devtools': '1.6.1',
  '@ankhorage/expo-runtime': '3.0.5',
  '@ankhorage/permissions': '0.2.3',
  '@ankhorage/supabase-auth': '1.2.6',
} as const;
const EXPECTED_EXPO_RUNTIME_VERSION = EXPECTED_GENERATED_OWNER_VERSIONS['@ankhorage/expo-runtime'];
const ROUTER_REWRITE_DISABLED = '1';

export async function prepareNativeCapabilityEvidenceAsync(workspaceRoot: string): Promise<void> {
  await assertFreshWorkspaceAsync(workspaceRoot);
  const node24Path = await resolveNode24PathAsync();
  const commandEnv = createCommandEnvironment(node24Path);
  const generatorRoot = path.join(workspaceRoot, '.generator');
  await mkdir(generatorRoot, { recursive: true });

  await writeGeneratorPackageAsync(generatorRoot, {});
  const templateRange = await resolvePublishedTemplateRangeAsync(generatorRoot);
  await writeGeneratorPackageAsync(generatorRoot, {
    '@ankhorage/expo-runtime': EXPECTED_EXPO_RUNTIME_VERSION,
    '@ankhorage/permissions': EXPECTED_GENERATED_OWNER_VERSIONS['@ankhorage/permissions'],
    '@ankhorage/studio': NATIVE_EVIDENCE_STUDIO_VERSION,
    '@ankhorage/supabase-auth': EXPECTED_GENERATED_OWNER_VERSIONS['@ankhorage/supabase-auth'],
    '@ankhorage/templates': templateRange,
  });
  await createLockfileAndColdInstallAsync(generatorRoot, commandEnv, 'released generator');
  await assertInstalledPackageVersionsAsync(generatorRoot, {
    '@ankhorage/expo-runtime': EXPECTED_EXPO_RUNTIME_VERSION,
    '@ankhorage/permissions': EXPECTED_GENERATED_OWNER_VERSIONS['@ankhorage/permissions'],
    '@ankhorage/studio': NATIVE_EVIDENCE_STUDIO_VERSION,
    '@ankhorage/supabase-auth': EXPECTED_GENERATED_OWNER_VERSIONS['@ankhorage/supabase-auth'],
  });

  await writeFile(
    path.join(generatorRoot, 'generate.ts'),
    createGenerationDriverSource(workspaceRoot),
    'utf8',
  );
  await runCommandAsync(
    generatorRoot,
    'Generate native evidence app through released Studio',
    ['generate.ts'],
    commandEnv,
  );

  const appRoot = path.join(workspaceRoot, 'apps', NATIVE_EVIDENCE_APP_ID);
  await configureNativeEvidenceDevelopmentClientAsync(appRoot);
  await writeNativeEvidenceAppFilesAsync(appRoot);
  const lockfileFingerprint = await createLockfileAndColdInstallAsync(
    workspaceRoot,
    commandEnv,
    'native evidence workspace',
  );
  await assertInstalledPackageVersionsAsync(workspaceRoot, EXPECTED_GENERATED_OWNER_VERSIONS);
  await assertReleasedNativeOAuthWiringAsync(appRoot);
  const checkResults = await runGeneratedNativeEvidenceChecksAsync(appRoot, commandEnv);
  await assertNativePrebuildAsync(appRoot);
  await writeBaselineEvidenceAsync({
    appRoot,
    checkResults,
    generatorRoot,
    lockfileFingerprint,
    node24Path,
    workspaceRoot,
  });

  console.log(`\nNative evidence fixture prepared at ${appRoot}`);
}

interface NativeEvidenceCheckResults {
  readonly doctor: string;
  readonly reactCompiler: string;
  readonly routerTypesBytes: number;
}

async function assertDevtoolsSyncIdempotentAsync(
  appRoot: string,
  commandEnv: Readonly<Record<string, string>>,
): Promise<void> {
  const args = ['x', '@ankhorage/ankh', 'devtools', 'sync', '.'] as const;
  await runCommandAsync(appRoot, 'Synchronize generated Devtools configuration', args, commandEnv);
  const lockPath = path.join(appRoot, '..', '..', 'bun.lock');
  const lockAfterFirstSync = await readFile(lockPath);
  const secondSync = await runCommandOutputAsync(
    appRoot,
    'Verify generated Devtools synchronization is idempotent',
    args,
    commandEnv,
  );
  if (/\b(?:created|updated)\b/u.test(secondSync)) {
    throw new Error(`Second generated Devtools sync was not idempotent:\n${secondSync}`);
  }
  const lockAfterSecondSync = await readFile(lockPath);
  if (!lockAfterFirstSync.equals(lockAfterSecondSync)) {
    throw new Error('Second generated Devtools synchronization mutated the workspace lockfile.');
  }
}

async function assertInstalledPackageVersionsAsync(
  installationRoot: string,
  expectedVersions: Readonly<Record<string, string>>,
): Promise<void> {
  for (const [packageName, expectedVersion] of Object.entries(expectedVersions)) {
    const packageJson = await readPackageJsonAsync(
      path.join(installationRoot, 'node_modules', ...packageName.split('/'), 'package.json'),
    );
    assertPackageVersion(packageJson, packageName, expectedVersion);
  }
}

async function assertNativePrebuildAsync(appRoot: string): Promise<void> {
  const androidManifest = await readFile(
    path.join(appRoot, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'),
    'utf8',
  );
  for (const expected of [
    'android.permission.CAMERA',
    'android.permission.RECORD_AUDIO',
    NATIVE_EVIDENCE_ANDROID_SCHEME,
  ]) {
    if (!androidManifest.includes(expected)) {
      throw new Error(`Android native evidence prebuild is missing ${expected}.`);
    }
  }
  const infoPlist = await readNativeInfoPlistAsync(path.join(appRoot, 'ios'));
  for (const expected of [
    'CFBundleURLTypes',
    NATIVE_EVIDENCE_IOS_SCHEME,
    'NSCameraUsageDescription',
    'NSMicrophoneUsageDescription',
    'NSPhotoLibraryUsageDescription',
  ]) {
    if (!infoPlist.includes(expected)) {
      throw new Error(`iOS native evidence prebuild is missing ${expected}.`);
    }
  }
}

async function assertRouterTypesAsync(appRoot: string): Promise<number> {
  const routerTypes = await readFile(path.join(appRoot, '.expo', 'types', 'router.d.ts'), 'utf8');
  if (!routerTypes.trim()) throw new Error('Expo Router generated an empty route declaration.');
  for (const route of ['auth/callback', 'native-evidence', 'sign-in']) {
    if (!routerTypes.includes(route)) {
      throw new Error(`Expo Router declarations are missing native evidence route ${route}.`);
    }
  }
  return Buffer.byteLength(routerTypes);
}

async function createLockfileAndColdInstallAsync(
  installationRoot: string,
  commandEnv: Readonly<Record<string, string>>,
  label: string,
): Promise<string> {
  await runCommandAsync(
    installationRoot,
    `Create ${label} lockfile`,
    ['install', '--lockfile-only', '--linker=hoisted', '--os=*', '--cpu=*'],
    commandEnv,
  );
  const lockPath = path.join(installationRoot, 'bun.lock');
  const locked = await readFile(lockPath);
  await runCommandAsync(
    installationRoot,
    `Cold frozen install for ${label}`,
    ['install', '--frozen-lockfile', '--linker=hoisted', '--no-cache'],
    commandEnv,
  );
  const installed = await readFile(lockPath);
  if (!locked.equals(installed)) {
    throw new Error(`Cold frozen install mutated the ${label} lockfile.`);
  }
  return createHash('sha256').update(installed).digest('hex');
}

async function configureNativeEvidenceDevelopmentClientAsync(appRoot: string): Promise<void> {
  const appConfigPath = path.join(appRoot, 'app.config.ts');
  const appConfig = await readFile(appConfigPath, 'utf8');
  const pluginListStart = "const GENERATED_PLUGINS: NonNullable<ExpoConfig['plugins']> = [";
  if (!appConfig.includes(pluginListStart)) {
    throw new Error('Generated app config does not contain the expected plugin list.');
  }
  const developmentClientPlugin = `${pluginListStart}\n  ['expo-dev-client', { skipOnboarding: true, showMenuAtLaunch: false, toolsButton: false }],`;
  await writeFile(
    appConfigPath,
    appConfig.replace(pluginListStart, developmentClientPlugin),
    'utf8',
  );
}

async function assertFreshWorkspaceAsync(workspaceRoot: string): Promise<void> {
  if (!path.isAbsolute(workspaceRoot)) {
    throw new Error('Native evidence workspace path must be absolute.');
  }
  try {
    await stat(workspaceRoot);
    throw new Error(
      `Native evidence workspace already exists: ${workspaceRoot}. Choose a fresh path.`,
    );
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return;
    throw error;
  }
}

async function assertReleasedNativeOAuthWiringAsync(appRoot: string): Promise<void> {
  const adapter = await readFile(path.join(appRoot, 'src', 'auth', 'adapter.ts'), 'utf8');
  for (const expected of [
    "import { getRandomBytes } from 'expo-crypto';",
    'oauthRandomBytes: getRandomBytes',
  ]) {
    if (!adapter.includes(expected)) {
      throw new Error(`Released Studio auth generation is missing ${expected}.`);
    }
  }
}

function assertPackageVersion(
  packageJson: Readonly<Record<string, unknown>>,
  packageName: string,
  expectedVersion: string,
): void {
  if (packageJson.name !== packageName || packageJson.version !== expectedVersion) {
    throw new Error(
      `Registry installation resolved ${String(packageJson.name)}@${String(
        packageJson.version,
      )}; expected ${packageName}@${expectedVersion}.`,
    );
  }
}

async function readPackageJsonAsync(filePath: string): Promise<Readonly<Record<string, unknown>>> {
  const parsed: unknown = JSON.parse(await readFile(filePath, 'utf8'));
  if (!isRecord(parsed)) throw new Error(`Invalid package metadata at ${filePath}.`);
  return parsed;
}

function createCommandEnvironment(nodePath: string): Readonly<Record<string, string>> {
  const currentPath = getPathEnvironment();
  const taskTempDirectory = getEnvironmentValue('TMPDIR');
  return {
    PATH: `${path.dirname(nodePath)}:${currentPath}`,
    ...(taskTempDirectory ? { TMPDIR: taskTempDirectory } : {}),
  };
}

function getPathEnvironment(): string {
  return getEnvironmentValue('PATH') ?? '';
}

function getEnvironmentValue(name: string): string | undefined {
  const environment = Bun.env as unknown as Readonly<Record<string, unknown>>;
  const value = Reflect.get(environment, name);
  return typeof value === 'string' ? value : undefined;
}

async function readNativeInfoPlistAsync(rootPath: string): Promise<string> {
  const entries = await readdir(rootPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      const nested = await readNativeInfoPlistAsync(entryPath).catch(() => '');
      if (nested) return nested;
    } else if (entry.isFile() && entry.name === 'Info.plist') {
      return readFile(entryPath, 'utf8');
    }
  }
  if (rootPath.endsWith('/ios')) throw new Error('iOS prebuild did not generate an Info.plist.');
  return '';
}

async function resolvePublishedTemplateRangeAsync(cwd: string): Promise<string> {
  const versionOutput = await runAcceptanceCommandAsync({
    args: [
      'pm',
      'view',
      `@ankhorage/studio@${NATIVE_EVIDENCE_STUDIO_VERSION}`,
      'version',
      '--json',
    ],
    captureOutput: true,
    command: 'bun',
    cwd,
    label: 'Resolve Studio native-evidence release metadata from registry',
    timeoutMs: 30_000,
  });
  const version: unknown = JSON.parse(versionOutput);
  if (version !== NATIVE_EVIDENCE_STUDIO_VERSION) {
    throw new Error('Registry did not return the exact required Studio release metadata.');
  }
  const dependenciesOutput = await runAcceptanceCommandAsync({
    args: [
      'pm',
      'view',
      `@ankhorage/studio@${NATIVE_EVIDENCE_STUDIO_VERSION}`,
      'dependencies',
      '--json',
    ],
    captureOutput: true,
    command: 'bun',
    cwd,
    label: 'Resolve released Studio dependency metadata',
    timeoutMs: 30_000,
  });
  const dependencies: unknown = JSON.parse(dependenciesOutput);
  const templateRange = isRecord(dependencies)
    ? Reflect.get(dependencies, '@ankhorage/templates')
    : undefined;
  if (typeof templateRange !== 'string') {
    throw new Error('Released Studio metadata does not declare @ankhorage/templates.');
  }
  return templateRange;
}

async function resolveNode24PathAsync(): Promise<string> {
  for (const binDirectory of getPathEnvironment().split(':')) {
    const candidate = path.join(binDirectory, 'node');
    try {
      await access(candidate);
    } catch {
      continue;
    }
    const childProcess = Bun.spawn([candidate, '--version'], { stderr: 'ignore', stdout: 'pipe' });
    const version = (await new Response(childProcess.stdout).text()).trim();
    if ((await childProcess.exited) === 0 && version.startsWith('v24.')) return candidate;
  }
  throw new Error('Node 24 LTS is required for the generated Expo 57 native evidence fixture.');
}

function readCheckSummary(output: string, pattern: RegExp, label: string): string {
  const match = pattern.exec(output);
  if (!match?.[1] || !match[2]) throw new Error(`${label} did not report a complete check count.`);
  return `${match[1]}/${match[2]}`;
}

async function runNativeEvidenceExportsAsync(
  appRoot: string,
  expoEnv: Readonly<Record<string, string>>,
): Promise<void> {
  const environment = {
    ...expoEnv,
    EXPO_PUBLIC_NATIVE_EVIDENCE_URL: `http://127.0.0.1:${NATIVE_EVIDENCE_SERVER_PORT}`,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-public-anon-key',
    EXPO_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${NATIVE_EVIDENCE_SERVER_PORT}`,
  };
  for (const platform of ['web', 'android', 'ios'] as const) {
    await runExpoCommandAsync(
      appRoot,
      `Export native evidence JavaScript for ${platform}`,
      ['export', '--platform', platform, '--output-dir', `dist-${platform}`, '--clear'],
      environment,
    );
  }
  await runExpoCommandAsync(
    appRoot,
    'Regenerate clean native projects for the development client',
    ['prebuild', '--clean', '--no-install'],
    environment,
  );
}

async function runGeneratedNativeEvidenceChecksAsync(
  appRoot: string,
  commandEnv: Readonly<Record<string, string>>,
): Promise<NativeEvidenceCheckResults> {
  const expoEnv = {
    ...commandEnv,
    EXPO_NO_TELEMETRY: '1',
    EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK: ROUTER_REWRITE_DISABLED,
  };
  await assertDevtoolsSyncIdempotentAsync(appRoot, commandEnv);
  await runCommandAsync(
    appRoot,
    'Check native evidence formatting',
    ['run', 'format:check'],
    commandEnv,
  );
  await runCommandAsync(appRoot, 'Lint native evidence app', ['run', 'lint'], commandEnv);
  await runExpoCommandAsync(
    appRoot,
    'Check Expo dependency compatibility',
    ['install', '--check'],
    expoEnv,
  );
  const doctorOutput = await runCommandOutputAsync(
    appRoot,
    'Run Expo Doctor',
    ['run', 'doctor'],
    expoEnv,
  );
  const doctor = readCheckSummary(doctorOutput, /(\d+)\/(\d+) checks passed/u, 'Expo Doctor');
  if (doctor !== '21/21') throw new Error(`Expo Doctor returned ${doctor}; expected 21/21.`);
  await generateExpoRouterTypesAsync({
    env: expoEnv,
    label: 'Generate native evidence Expo Router declarations',
    projectRoot: appRoot,
    timeoutMs: 120_000,
  });
  const routerTypesBytes = await assertRouterTypesAsync(appRoot);
  await runCommandAsync(appRoot, 'Run native evidence TypeScript 6', ['run', 'typecheck'], expoEnv);
  const compilerOutput = await runCommandOutputAsync(
    appRoot,
    'Run native evidence React Compiler healthcheck',
    ['x', 'react-compiler-healthcheck@latest'],
    expoEnv,
  );
  const reactCompiler = readCheckSummary(
    compilerOutput,
    /Successfully compiled (\d+) out of (\d+) components/u,
    'React Compiler healthcheck',
  );
  await runNativeEvidenceExportsAsync(appRoot, expoEnv);
  return { doctor, reactCompiler, routerTypesBytes };
}

async function runCommandAsync(
  cwd: string,
  label: string,
  args: readonly string[],
  env?: Readonly<Record<string, string>>,
): Promise<void> {
  await runAcceptanceCommandAsync({
    args,
    command: 'bun',
    cwd,
    env,
    label,
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
}

async function runCommandOutputAsync(
  cwd: string,
  label: string,
  args: readonly string[],
  env?: Readonly<Record<string, string>>,
): Promise<string> {
  return runAcceptanceCommandAsync({
    args,
    captureOutput: true,
    command: 'bun',
    cwd,
    env,
    label,
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
}

async function runExpoCommandAsync(
  cwd: string,
  label: string,
  args: readonly string[],
  env: Readonly<Record<string, string>>,
): Promise<void> {
  await runAcceptanceCommandAsync({
    args: ['x', 'expo', ...args],
    command: 'bun',
    cwd,
    env: { ...env, EXPO_NO_TELEMETRY: '1' },
    label,
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
}

async function writeBaselineEvidenceAsync(args: {
  readonly appRoot: string;
  readonly checkResults: NativeEvidenceCheckResults;
  readonly generatorRoot: string;
  readonly lockfileFingerprint: string;
  readonly node24Path: string;
  readonly workspaceRoot: string;
}): Promise<void> {
  const packageNames = [
    '@ankhorage/devtools',
    '@ankhorage/expo-runtime',
    '@ankhorage/permissions',
    '@ankhorage/supabase-auth',
    'expo',
    'expo-crypto',
    'expo-dev-client',
    'expo-document-picker',
    'expo-file-system',
    'expo-image-picker',
    'expo-router',
    'typescript',
  ] as const;
  const versions = new Map<string, string>([['@ankhorage/studio', NATIVE_EVIDENCE_STUDIO_VERSION]]);
  for (const packageName of packageNames) {
    const packageJson = await readPackageJsonAsync(
      path.join(args.workspaceRoot, 'node_modules', ...packageName.split('/'), 'package.json'),
    );
    if (typeof packageJson.version !== 'string') {
      throw new Error(`Installed package ${packageName} has no version.`);
    }
    versions.set(packageName, packageJson.version);
  }
  const generatorLock = await readFile(path.join(args.generatorRoot, 'bun.lock'), 'utf8');
  if (!generatorLock.includes(`@ankhorage/studio@${NATIVE_EVIDENCE_STUDIO_VERSION}`)) {
    throw new Error('Generator lockfile does not resolve the expected Studio release.');
  }
  await mkdir(path.join(args.workspaceRoot, 'evidence'), { recursive: true });
  await writeFile(
    path.join(args.workspaceRoot, 'evidence', 'baseline.json'),
    `${JSON.stringify(
      {
        checks: args.checkResults,
        generatedWith: `@ankhorage/studio@${NATIVE_EVIDENCE_STUDIO_VERSION}`,
        lockfileSha256: args.lockfileFingerprint,
        nativeProjects: { android: 'clean-prebuild', ios: 'clean-prebuild' },
        node: await resolveExecutableVersionAsync(args.node24Path),
        versions: Object.fromEntries(versions),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

async function resolveExecutableVersionAsync(executable: string): Promise<string> {
  const childProcess = Bun.spawn([executable, '--version'], { stderr: 'ignore', stdout: 'pipe' });
  const output = (await new Response(childProcess.stdout).text()).trim();
  if ((await childProcess.exited) !== 0 || output.length === 0) {
    throw new Error(`Unable to resolve version for ${executable}.`);
  }
  return output;
}

async function writeGeneratorPackageAsync(
  generatorRoot: string,
  dependencies: Readonly<Record<string, string>>,
): Promise<void> {
  await writeFile(
    path.join(generatorRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: '@ankhorage/expo57-native-evidence-generator',
        private: true,
        packageManager: 'bun@1.3.14',
        dependencies,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

async function writeNativeEvidenceAppFilesAsync(appRoot: string): Promise<void> {
  const nativeEvidenceRoot = path.join(appRoot, 'src', 'native-evidence');
  await mkdir(nativeEvidenceRoot, { recursive: true });
  await Promise.all([
    writeFile(
      path.join(nativeEvidenceRoot, 'native-evidence-client.ts'),
      createNativeEvidenceClientSource(),
      'utf8',
    ),
    writeFile(
      path.join(nativeEvidenceRoot, 'native-evidence-controller.ts'),
      createNativeEvidenceControllerSource(),
      'utf8',
    ),
    writeFile(
      path.join(nativeEvidenceRoot, 'native-evidence-scenarios.ts'),
      createNativeEvidenceScenariosSource(),
      'utf8',
    ),
    writeFile(
      path.join(nativeEvidenceRoot, 'native-evidence-screen.tsx'),
      createNativeEvidenceScreenSource(),
      'utf8',
    ),
    writeFile(
      path.join(appRoot, 'src', 'app', 'native-evidence.tsx'),
      createNativeEvidenceRouteSource(),
      'utf8',
    ),
    writeFile(
      path.join(appRoot, 'src', 'app', '(auth)', 'sign-in.tsx'),
      createNativeEvidenceRouteSource(),
      'utf8',
    ),
  ]);
  const layoutPath = path.join(appRoot, 'src', 'app', '_layout.tsx');
  const layout = await readFile(layoutPath, 'utf8');
  const callbackScreen = '      <Stack.Screen key="oauth-callback" name="auth/callback" />';
  if (!layout.includes(callbackScreen)) {
    throw new Error('Generated root layout does not contain the expected OAuth callback screen.');
  }
  const nativeEvidenceScreen =
    '      <Stack.Screen key="native-evidence" name="native-evidence" />';
  await writeFile(
    layoutPath,
    layout.replace(callbackScreen, `${callbackScreen}\n${nativeEvidenceScreen}`),
    'utf8',
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
