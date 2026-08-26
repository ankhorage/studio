import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { ProjectManager } from '../orchestrator/projectManager';
import { assertNoBrowserErrors } from './assertNoBrowserErrors';
import { ChromeNavigationSession } from './ChromeNavigationSession';
import { createExpo57NavigationFixtureManifest } from './createExpo57NavigationFixtureManifest';
import { createStaticExportServer } from './createStaticExportServer';
import { generateExpoRouterTypesAsync } from './generateExpoRouterTypesAsync';
import { reserveTcpPortAsync } from './reserveTcpPortAsync';
import { runAcceptanceCommandAsync } from './runAcceptanceCommandAsync';

const COMMAND_TIMEOUT_MS = 180_000;
const FORBIDDEN_REACT_NAVIGATION_IMPORT =
  /(?:from\s*|import\s*\(|require\s*\()\s*['"]@react-navigation\//u;
const HTTP_TIMEOUT_MS = 120_000;
const RELEASED_STUDIO_VERSION = '2.0.7';
const ROUTER_REWRITE_DISABLED = '1';

export async function runExpo57GeneratedNavigationAcceptanceAsync(): Promise<void> {
  const workspaceRoot = await mkdtemp(path.join('/tmp', 'ankh-expo57-navigation-'));
  let staticServer: ReturnType<typeof Bun.serve> | null = null;

  try {
    await createWorkspaceAsync(workspaceRoot);
    const manager = new ProjectManager(workspaceRoot);
    const standalone = await createProjectAsync(manager, {
      auth: false,
      includeStudio: false,
      name: 'Expo 57 Navigation Standalone',
    });
    const studio = await createProjectAsync(manager, {
      auth: true,
      includeStudio: true,
      name: 'Expo 57 Navigation Studio',
    });
    const authRuntime = await createProjectAsync(manager, {
      auth: true,
      includeStudio: false,
      name: 'Expo 57 Auth Runtime',
    });
    const rootTabs = await createProjectAsync(manager, {
      auth: false,
      includeStudio: false,
      name: 'Expo 57 Root Tabs',
      rootNavigator: 'tabs',
    });
    const rootDrawer = await createProjectAsync(manager, {
      auth: false,
      includeStudio: false,
      name: 'Expo 57 Root Drawer',
      rootNavigator: 'drawer',
    });
    await createWorkspaceLockfileAsync(workspaceRoot);
    await runCommandAsync({
      args: ['install', '--frozen-lockfile', '--linker=hoisted'],
      command: 'bun',
      cwd: workspaceRoot,
      label: 'Cold frozen navigation workspace install',
    });
    await assertGeneratedNavigationContractAsync(standalone);
    await runGeneratedProjectChecksAsync(standalone);
    await runDevelopmentNavigationSmokeAsync(standalone.path);
    staticServer = createStaticExportServer(standalone.path);
    if (staticServer.port === undefined) throw new Error('Static export server has no TCP port.');
    await runStaticExportSmokeAsync(staticServer.port);
    await staticServer.stop(true);
    staticServer = null;

    await assertGeneratedNavigationContractAsync(studio);
    await runGeneratedProjectChecksAsync(studio);
    await assertReleasedStudioPackageAsync(workspaceRoot, studio);
    await assertGeneratedNavigationContractAsync(authRuntime);
    await runSignedOutAuthNavigationSmokeAsync(authRuntime.path);

    await runFocusedRootNavigatorChecksAsync(rootTabs);
    await runFocusedRootNavigatorChecksAsync(rootDrawer);
  } finally {
    await staticServer?.stop(true);
    await rm(workspaceRoot, { force: true, recursive: true });
  }
}

async function assertGeneratedNavigationContractAsync(project: NavigationProject): Promise<void> {
  const packageJson = JSON.parse(
    await readFile(path.join(project.path, 'package.json'), 'utf8'),
  ) as { readonly dependencies?: Readonly<Record<string, string>> };
  const dependencies = packageJson.dependencies ?? {};

  for (const dependency of Object.keys(dependencies)) {
    if (dependency.startsWith('@react-navigation/')) {
      throw new Error(`${project.id} directly declares forbidden dependency ${dependency}.`);
    }
  }

  const sourceFiles = await listSourceFilesAsync(path.join(project.path, 'src'));
  let generatedSource = '';
  for (const file of sourceFiles) {
    const source = await readFile(file, 'utf8');
    generatedSource += source;
    if (FORBIDDEN_REACT_NAVIGATION_IMPORT.test(source)) {
      throw new Error(`${project.id} contains a forbidden React Navigation import in ${file}.`);
    }
  }

  for (const forbiddenFile of ['babel.config.js', 'metro.config.js']) {
    if (await pathExistsAsync(path.join(project.path, forbiddenFile))) {
      throw new Error(`${project.id} unexpectedly generated compatibility file ${forbiddenFile}.`);
    }
  }

  if (!generatedSource.includes("from 'expo-router/js-tabs'")) {
    throw new Error(`${project.id} does not consume Router-owned JavaScript tabs.`);
  }
  if (!generatedSource.includes("from 'expo-router/drawer'")) {
    throw new Error(`${project.id} does not consume Router-owned Drawer APIs.`);
  }
  if (!generatedSource.includes('<ZoraTabBar {...props} routeMap={routeMap} />')) {
    throw new Error(`${project.id} does not generate the direct custom ZORA tab bridge.`);
  }
  if (!generatedSource.includes('<ZoraDrawerContent {...props} routeMap={routeMap} />')) {
    throw new Error(`${project.id} does not generate the direct custom ZORA drawer bridge.`);
  }
  const appRoot = path.join(project.path, 'src', 'app', ...(project.auth ? ['(app)'] : []));
  const hiddenRoute = path.join(appRoot, 'hidden-tabs', 'secret.tsx');
  const hiddenTabsLayout = path.join(appRoot, 'hidden-tabs', '(tabs)', '_layout.tsx');
  if (!(await pathExistsAsync(hiddenRoute)) || !(await pathExistsAsync(hiddenTabsLayout))) {
    throw new Error(
      `${project.id} does not preserve its hidden route outside the visible tab group.`,
    );
  }
  if ((await readFile(hiddenTabsLayout, 'utf8')).includes('name="secret"')) {
    throw new Error(`${project.id} exposes its hidden route in the visible tab navigator.`);
  }
  if (generatedSource.includes('Parameters<typeof Zora')) {
    throw new Error(`${project.id} still contains a ZORA navigation compatibility cast.`);
  }

  if (project.auth) {
    for (const expected of [
      '<Stack.Protected',
      'name="(app)"',
      'name="(auth)"',
      "initialRouteName: '(app)'",
    ]) {
      if (!generatedSource.includes(expected)) {
        throw new Error(`${project.id} is missing protected-route evidence: ${expected}`);
      }
    }
  }
}

async function assertReleasedStudioPackageAsync(
  workspaceRoot: string,
  studioProject: NavigationProject,
): Promise<void> {
  const generatedPackage = JSON.parse(
    await readFile(path.join(studioProject.path, 'package.json'), 'utf8'),
  ) as { readonly dependencies?: Readonly<Record<string, string>> };
  const studioRange = generatedPackage.dependencies?.['@ankhorage/studio'];
  if (studioRange !== '^2.0.2') {
    throw new Error(`Studio-enabled navigation fixture resolved unexpected range ${studioRange}.`);
  }

  const installedPackagePath = path.join(
    workspaceRoot,
    'node_modules',
    '@ankhorage',
    'studio',
    'package.json',
  );
  const installedPackage = JSON.parse(await readFile(installedPackagePath, 'utf8')) as {
    readonly version?: unknown;
  };
  if (installedPackage.version !== RELEASED_STUDIO_VERSION) {
    throw new Error(
      `Studio-enabled navigation fixture must consume released Studio ${RELEASED_STUDIO_VERSION}, received ${String(installedPackage.version)}.`,
    );
  }

  const workspaceLock = await readFile(path.join(workspaceRoot, 'bun.lock'), 'utf8');
  if (
    !workspaceLock.includes(`"@ankhorage/studio": ["@ankhorage/studio@${RELEASED_STUDIO_VERSION}"`)
  ) {
    throw new Error('Studio fixture lockfile does not contain the released registry resolution.');
  }
}

async function assertRouterTypesAsync(
  project: NavigationProject,
  routeEvidence: readonly string[] = [
    'profile/[id]',
    'catalog/settings',
    '(tabs)',
    'hidden-tabs/secret',
  ],
): Promise<void> {
  const routerTypesPath = path.join(project.path, '.expo', 'types', 'router.d.ts');
  const routerTypesStat = await stat(routerTypesPath);
  if (!routerTypesStat.isFile() || routerTypesStat.size === 0) {
    throw new Error(`${project.id} did not generate non-empty Router declarations.`);
  }

  const routerTypes = await readFile(routerTypesPath, 'utf8');
  for (const route of routeEvidence) {
    if (!routerTypes.includes(route)) {
      throw new Error(`${project.id} Router declarations are missing ${route}.`);
    }
  }
}

async function generateRouterTypesAsync(project: NavigationProject): Promise<void> {
  await generateExpoRouterTypesAsync({
    env: {
      EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK: ROUTER_REWRITE_DISABLED,
    },
    label: `${project.id} Expo Router typed-route generation`,
    projectRoot: project.path,
    timeoutMs: HTTP_TIMEOUT_MS,
  });
}

async function createProjectAsync(
  manager: ProjectManager,
  options: {
    readonly auth: boolean;
    readonly includeStudio: boolean;
    readonly name: string;
    readonly rootNavigator?: 'drawer' | 'tabs';
  },
): Promise<NavigationProject> {
  const created = await manager.createProject(
    options.name,
    { category: 'developer_tools', templateId: 'default' },
    undefined,
    { includeStudio: options.includeStudio },
  );
  const baseManifest = await manager.getProjectManifest(created.id);
  const manifest = createExpo57NavigationFixtureManifest(baseManifest, {
    auth: options.auth,
    name: options.name,
    ...(options.rootNavigator ? { rootNavigator: options.rootNavigator } : {}),
    slug: created.id,
  });
  await manager.saveProjectManifest({ projectId: created.id, manifest, mutations: [] });
  return { ...options, id: created.id, path: created.path };
}

async function createWorkspaceAsync(workspaceRoot: string): Promise<void> {
  await mkdir(path.join(workspaceRoot, 'apps'), { recursive: true });
  await writeFile(
    path.join(workspaceRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: '@ankhorage/expo57-navigation-acceptance',
        packageManager: 'bun@1.3.14',
        private: true,
        workspaces: ['apps/*'],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

async function createWorkspaceLockfileAsync(workspaceRoot: string): Promise<void> {
  await runCommandAsync({
    args: ['install', '--linker=hoisted', '--lockfile-only', '--os=*', '--cpu=*'],
    command: 'bun',
    cwd: workspaceRoot,
    label: 'Create generated navigation workspace lockfile',
  });
}

async function listSourceFilesAsync(rootPath: string): Promise<string[]> {
  const entries = await readdir(rootPath, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) files.push(...(await listSourceFilesAsync(entryPath)));
    else if (entry.isFile() && /\.[cm]?[jt]sx?$/u.test(entry.name)) files.push(entryPath);
  }
  return files;
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

async function runCommandAsync(options: AcceptanceCommand): Promise<string> {
  return runAcceptanceCommandAsync({
    ...options,
    env: {
      EXPO_NO_TELEMETRY: '1',
      ...(options.routerCommand
        ? { EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK: ROUTER_REWRITE_DISABLED }
        : {}),
    },
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
}

async function runDevelopmentNavigationSmokeAsync(projectRoot: string): Promise<void> {
  await runDevelopmentWebAsync(projectRoot, async (chrome, rootUrl) => {
    await chrome.navigateAsync(`${rootUrl}/profile/grace?source=direct`);
    await chrome.waitForLocationAsync({ pathname: '/profile/grace', search: '?source=direct' });
    await chrome.waitForBodyTextAsync('Dynamic Profile Route');

    await chrome.navigateAsync(rootUrl);
    await chrome.waitForBodyTextAsync('Navigation Home');
    await chrome.clickByTestIdAsync('home-profile');
    await chrome.waitForLocationAsync({ pathname: '/profile/ada', search: '?source=internal' });
    await chrome.waitForBodyTextAsync('Dynamic Profile Route');

    await chrome.goBackAsync();
    await chrome.waitForLocationAsync({ pathname: '/' });
    await chrome.waitForBodyTextAsync('Navigation Home');
    await chrome.goForwardAsync();
    await chrome.waitForLocationAsync({ pathname: '/profile/ada', search: '?source=internal' });
    await chrome.waitForBodyTextAsync('Dynamic Profile Route');
    await chrome.goBackAsync();
    await chrome.waitForLocationAsync({ pathname: '/' });

    await chrome.clickByRoleAndNameAsync('tab', 'Catalog');
    await chrome.waitForLocationAsync({ pathname: '/catalog' });
    await chrome.waitForBodyTextAsync('Catalog Drawer Route');
    await chrome.clickByRoleAndNameAsync('button', 'Show navigation menu');
    await chrome.clickByRoleAndNameAsync('button', 'Catalog Settings');
    await chrome.waitForLocationAsync({ pathname: '/catalog/settings' });
    await chrome.waitForBodyTextAsync('Catalog Settings Route');

    await chrome.navigateAsync(`${rootUrl}/hidden-tabs`);
    await chrome.waitForBodyTextAsync('Visible Navigation Route');
    if (!(await chrome.hasRoleAndNameAsync('tab', 'Visible'))) {
      throw new Error('Visible generated tab is unavailable.');
    }
    if (await chrome.hasRoleAndNameAsync('tab', 'Secret')) {
      throw new Error('Hidden generated route is exposed by ZoraTabBar.');
    }
    await chrome.navigateAsync(`${rootUrl}/hidden-tabs/secret`);
    await chrome.waitForBodyTextAsync('Hidden Navigation Route');
    assertNoBrowserErrors(chrome.errors, 'development navigation');
  });
}

async function runDevelopmentWebAsync(
  projectRoot: string,
  smoke: (chrome: ChromeNavigationSession, rootUrl: string) => Promise<void>,
): Promise<void> {
  const expoPort = await reserveTcpPortAsync('navigation smoke');
  const chromePort = await reserveTcpPortAsync('navigation Chrome debug');
  const output: string[] = [];
  const expoProcess = spawn(
    'bun',
    ['x', 'expo', 'start', '--web', '--port', String(expoPort), '--clear'],
    {
      cwd: projectRoot,
      detached: true,
      env: {
        ...process.env,
        BROWSER: 'none',
        CI: '1',
        EXPO_NO_TELEMETRY: '1',
        EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK: ROUTER_REWRITE_DISABLED,
      },
    },
  );
  collectProcessOutput(expoProcess, output);
  let chrome: ChromeNavigationSession | null = null;

  try {
    const rootUrl = `http://127.0.0.1:${expoPort}`;
    await waitForHttpAsync(rootUrl, () => output.join('').slice(-8_000));
    chrome = await ChromeNavigationSession.createAsync(chromePort);

    await smoke(chrome, rootUrl);
  } finally {
    chrome?.close();
    stopProcess(expoProcess);
  }
}

async function runFocusedRootNavigatorChecksAsync(project: NavigationProject): Promise<void> {
  if (!project.rootNavigator) throw new Error(`${project.id} has no focused root navigator.`);

  const rootLayout = await readFile(path.join(project.path, 'src', 'app', '_layout.tsx'), 'utf8');
  const expectedImport =
    project.rootNavigator === 'tabs' ? "from 'expo-router/js-tabs'" : "from 'expo-router/drawer'";
  const expectedBridge =
    project.rootNavigator === 'tabs'
      ? '<ZoraTabBar {...props} routeMap={routeMap} />'
      : '<ZoraDrawerContent {...props} routeMap={routeMap} />';
  if (!rootLayout.includes(expectedImport) || !rootLayout.includes(expectedBridge)) {
    throw new Error(`${project.id} does not generate its ${project.rootNavigator} at the root.`);
  }
  if (!rootLayout.includes('type Href') || FORBIDDEN_REACT_NAVIGATION_IMPORT.test(rootLayout)) {
    throw new Error(`${project.id} violates the narrow Expo Router Href boundary.`);
  }

  await generateRouterTypesAsync(project);
  await assertRouterTypesAsync(project, ['about']);
  await runCommandAsync({
    args: ['run', 'lint'],
    command: 'bun',
    cwd: project.path,
    label: `${project.id} focused root-${project.rootNavigator} lint`,
  });
  await runCommandAsync({
    args: ['run', 'typecheck'],
    command: 'bun',
    cwd: project.path,
    label: `${project.id} focused root-${project.rootNavigator} typecheck`,
  });
}

async function runGeneratedProjectChecksAsync(project: NavigationProject): Promise<void> {
  await generateRouterTypesAsync(project);
  await assertRouterTypesAsync(project);

  const commands: readonly AcceptanceCommand[] = [
    project.auth
      ? {
          args: [
            'x',
            'ankhorage-eslint',
            'src/app/(app)/(tabs)/_layout.tsx',
            'src/app/(app)/(tabs)/catalog/_layout.tsx',
            'src/app/(app)/hidden-tabs/_layout.tsx',
            'src/app/(app)/hidden-tabs/(tabs)/_layout.tsx',
            '--max-warnings=0',
          ],
          command: 'bun',
          cwd: project.path,
          label: `${project.id} navigation lint (auth scaffold remains owned by #312)`,
        }
      : { args: ['run', 'lint'], command: 'bun', cwd: project.path, label: `${project.id} lint` },
    {
      args: ['x', 'expo', 'install', '--check'],
      command: 'bun',
      cwd: project.path,
      label: `${project.id} Expo dependency compatibility`,
    },
    {
      args: ['run', 'doctor'],
      command: 'bun',
      cwd: project.path,
      label: `${project.id} Expo Doctor`,
    },
  ];
  for (const command of commands) await runCommandAsync(command);

  await runCommandAsync({
    args: ['run', 'typecheck'],
    command: 'bun',
    cwd: project.path,
    label: `${project.id} TypeScript 6 with generated Router declarations`,
  });
  await runCommandAsync({
    args: ['x', 'react-compiler-healthcheck@latest'],
    command: 'bun',
    cwd: project.path,
    label: `${project.id} React Compiler healthcheck`,
  });

  for (const platform of ['web', 'android', 'ios'] as const) {
    await runCommandAsync({
      args: [
        'x',
        'expo',
        'export',
        '--platform',
        platform,
        ...(platform === 'web' ? [] : ['--output-dir', `dist-${platform}`]),
        '--clear',
      ],
      command: 'bun',
      cwd: project.path,
      label:
        platform === 'web'
          ? `${project.id} rewrite-disabled static Web export`
          : `${project.id} rewrite-disabled ${platform} JavaScript export`,
      routerCommand: true,
    });
  }
}

async function runStaticExportSmokeAsync(port: number): Promise<void> {
  const chromePort = await reserveTcpPortAsync('static navigation Chrome debug');
  const chrome = await ChromeNavigationSession.createAsync(chromePort);
  try {
    const rootUrl = `http://127.0.0.1:${port}`;
    await chrome.navigateAsync(rootUrl);
    await chrome.waitForBodyTextAsync('Navigation Home');
    await chrome.clickByTestIdAsync('home-profile');
    await chrome.waitForLocationAsync({ pathname: '/profile/ada', search: '?source=internal' });
    await chrome.waitForBodyTextAsync('Dynamic Profile Route');
    assertNoBrowserErrors(chrome.errors, 'served static export');
  } finally {
    chrome.close();
  }
}

async function runSignedOutAuthNavigationSmokeAsync(projectRoot: string): Promise<void> {
  await runDevelopmentWebAsync(projectRoot, async (chrome, rootUrl) => {
    await chrome.navigateAsync(`${rootUrl}/sign-in`);
    await chrome.waitForBodyTextAsync('Sign in');
    await chrome.clearLocalStorageAsync();
    await chrome.navigateAsync(`${rootUrl}/profile/ada?source=protected`);
    await chrome.waitForLocationAsync({ pathname: '/sign-in' });
    const bodyText = await chrome.waitForBodyTextAsync('Sign in');
    if (bodyText.includes('Dynamic Profile Route')) {
      throw new Error('Signed-out Auth fixture exposed protected generated content.');
    }
    assertNoBrowserErrors(chrome.errors, 'signed-out Auth navigation');
  });
}

async function waitForHttpAsync(url: string, diagnostics: () => string): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < HTTP_TIMEOUT_MS) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      await Bun.sleep(500);
    }
  }
  throw new Error(`Timed out waiting for ${url}.\n${diagnostics()}`);
}

function collectProcessOutput(
  processToCollect: ChildProcessWithoutNullStreams,
  output: string[],
): void {
  processToCollect.stdout.on('data', (chunk: Buffer) => output.push(chunk.toString('utf8')));
  processToCollect.stderr.on('data', (chunk: Buffer) => output.push(chunk.toString('utf8')));
}

function stopProcess(processToStop: ChildProcessWithoutNullStreams): void {
  if (!processToStop.pid) return;
  try {
    globalThis.process.kill(-processToStop.pid, 'SIGTERM');
  } catch {
    processToStop.kill('SIGTERM');
  }
}

interface AcceptanceCommand {
  readonly args: readonly string[];
  readonly captureOutput?: boolean;
  readonly command: string;
  readonly cwd: string;
  readonly label: string;
  readonly routerCommand?: boolean;
}

interface NavigationProject {
  readonly auth: boolean;
  readonly id: string;
  readonly includeStudio: boolean;
  readonly name: string;
  readonly path: string;
  readonly rootNavigator?: 'drawer' | 'tabs';
}
