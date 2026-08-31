import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { startStudioHostServer } from '../http/server';
import { ProjectManager } from '../orchestrator/projectManager';
import { assertInstalledRegistryPackageAsync } from './assertInstalledRegistryPackageAsync';
import { assertNoBrowserErrors } from './assertNoBrowserErrors';
import { ChromeNavigationSession } from './ChromeNavigationSession';
import { createExpo57NavigationFixtureManifest } from './createExpo57NavigationFixtureManifest';
import { createStaticExportServer } from './createStaticExportServer';
import { generateExpoRouterTypesAsync } from './generateExpoRouterTypesAsync';
import { reserveTcpPortAsync } from './reserveTcpPortAsync';
import { resolveAppOwnedExpoCliAsync } from './resolveAppOwnedExpoCliAsync';
import { runAcceptanceCommandAsync } from './runAcceptanceCommandAsync';

const COMMAND_TIMEOUT_MS = 180_000;
const FORBIDDEN_REACT_NAVIGATION_IMPORT =
  /(?:from\s*|import\s*\(|require\s*\()\s*['"]@react-navigation\//u;
const HTTP_TIMEOUT_MS = 120_000;
const ROUTER_REWRITE_DISABLED = '1';

export async function runExpo57GeneratedNavigationAcceptanceAsync(): Promise<void> {
  const workspaceRoot = await mkdtemp(path.join('/tmp', 'ankh-expo57-navigation-'));
  let staticServer: ReturnType<typeof Bun.serve> | null = null;
  let studioHost: Awaited<ReturnType<typeof startStudioHostServer>> | null = null;

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
      postSignInRoute: 'about',
    });
    const themedRootStudio = await createProjectAsync(manager, {
      auth: true,
      hideRootAboutRoute: true,
      includeStudio: true,
      name: 'Expo 57 Themed Root Auth Studio',
      postSignInRoute: 'about',
      rootNavigator: 'drawer',
    });
    const integratedStudio = await createProjectAsync(manager, {
      auth: true,
      authScope: 'integrated',
      includeStudio: true,
      name: 'Expo 57 Integrated Auth Studio',
    });
    const noAuthStudio = await createProjectAsync(manager, {
      auth: true,
      authScope: 'none',
      includeStudio: true,
      name: 'Expo 57 No Auth Studio',
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
    const projects = [
      standalone,
      studio,
      themedRootStudio,
      integratedStudio,
      noAuthStudio,
      authRuntime,
      rootTabs,
      rootDrawer,
    ] as const;
    await rm(path.join(workspaceRoot, 'package.json'));
    const lockfileDigests = new Map<string, string>();
    for (const project of projects) {
      lockfileDigests.set(project.path, await installGeneratedProjectAsync(project));
    }
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
    await assertReleasedStudioPackageAsync(studio);
    const studioHostPort = await reserveTcpPortAsync('navigation Studio host');
    studioHost = await startStudioHostServer({
      host: '127.0.0.1',
      port: studioHostPort,
      projectRoot: workspaceRoot,
    });
    const studioApiUrl = `http://127.0.0.1:${studioHostPort}/api`;
    await runGlobalStudioAuthNavigationSmokeAsync(studio.path, studioApiUrl);
    await runGlobalStudioAuthBypassNavigationSmokeAsync(studio.path, studioApiUrl);
    await runThemedRootStudioAuthNavigationSmokeAsync(themedRootStudio, studioApiUrl);
    for (const project of [integratedStudio, noAuthStudio]) {
      await assertGeneratedNavigationContractAsync(project);
      await runScopeAwareStudioChecksAsync(project, studioApiUrl);
    }
    await assertGeneratedNavigationContractAsync(authRuntime);
    await runSignedOutAuthNavigationSmokeAsync(authRuntime.path);

    await runFocusedRootNavigatorChecksAsync(rootTabs);
    await runFocusedRootNavigatorChecksAsync(rootDrawer);
    for (const project of projects) {
      const expectedDigest = lockfileDigests.get(project.path);
      if (!expectedDigest) throw new Error(`${project.id} has no lockfile digest.`);
      const actualDigest = hash(await readFile(path.join(project.path, 'bun.lock')));
      if (actualDigest !== expectedDigest) {
        throw new Error(`${project.id} acceptance mutated its frozen lockfile.`);
      }
    }
  } finally {
    await staticServer?.stop(true);
    await studioHost?.close();
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

async function assertReleasedStudioPackageAsync(studioProject: NavigationProject): Promise<void> {
  const generatedPackage = JSON.parse(
    await readFile(path.join(studioProject.path, 'package.json'), 'utf8'),
  ) as { readonly dependencies?: Readonly<Record<string, string>> };
  const studioRange = generatedPackage.dependencies?.['@ankhorage/studio'];
  if (studioRange !== '^2.0.2') {
    throw new Error(`Studio-enabled navigation fixture resolved unexpected range ${studioRange}.`);
  }

  const projectLock = await readFile(path.join(studioProject.path, 'bun.lock'), 'utf8');
  await assertInstalledRegistryPackageAsync({
    installationRoot: studioProject.path,
    lockfile: projectLock,
    packageName: '@ankhorage/studio',
    range: studioRange,
  });
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
      __UNSAFE_EXPO_HOME_DIRECTORY: path.join(project.path, '.ankh', 'expo-home'),
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
    readonly authScope?: 'global' | 'integrated' | 'none';
    readonly hideRootAboutRoute?: boolean;
    readonly includeStudio: boolean;
    readonly name: string;
    readonly postSignInRoute?: 'about' | 'index';
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
    ...(options.authScope ? { authScope: options.authScope } : {}),
    name: options.name,
    ...(options.postSignInRoute ? { postSignInRoute: options.postSignInRoute } : {}),
    ...(options.rootNavigator ? { rootNavigator: options.rootNavigator } : {}),
    slug: created.id,
  });
  await manager.saveProjectManifest({ projectId: created.id, manifest, mutations: [] });
  return {
    ...options,
    auth: options.auth && (options.authScope ?? 'global') === 'global',
    id: created.id,
    path: created.path,
  };
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

async function installGeneratedProjectAsync(project: NavigationProject): Promise<string> {
  await runCommandAsync({
    args: ['install', '--lockfile-only', '--os=*', '--cpu=*'],
    command: 'bun',
    cwd: project.path,
    label: `${project.id} create app-owned lockfile`,
  });
  await rm(path.join(project.path, 'node_modules'), { force: true, recursive: true });
  const digest = hash(await readFile(path.join(project.path, 'bun.lock')));
  await runCommandAsync({
    args: ['install', '--frozen-lockfile'],
    command: 'bun',
    cwd: project.path,
    label: `${project.id} cold frozen app install`,
  });
  return digest;
}

function hash(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
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
      __UNSAFE_EXPO_HOME_DIRECTORY: path.join(options.cwd, '.ankh', 'expo-home'),
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

    await chrome.waitForHydratedRoleAndNameAsync('tab', 'Catalog');
    await chrome.clickByRoleAndNameAsync('tab', 'Catalog');
    await chrome.waitForLocationAsync({ pathname: '/catalog' });
    await chrome.waitForBodyTextAsync('Catalog Drawer Route');
    await chrome.waitForHydratedRoleAndNameAsync('button', 'Show navigation menu');
    await chrome.clickByRoleAndNameAsync('button', 'Show navigation menu');
    await chrome.waitForHydratedRoleAndNameAsync('button', 'Catalog Settings');
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
  env: Readonly<Record<string, string>> = {},
): Promise<void> {
  const expoCli = await resolveAppOwnedExpoCliAsync(projectRoot);
  const expoPort = await reserveTcpPortAsync('navigation smoke');
  const chromePort = await reserveTcpPortAsync('navigation Chrome debug');
  const output: string[] = [];
  const expoProcess = spawn(expoCli, ['start', '--web', '--port', String(expoPort), '--clear'], {
    cwd: projectRoot,
    detached: true,
    env: {
      ...process.env,
      __UNSAFE_EXPO_HOME_DIRECTORY: path.join(projectRoot, '.ankh', 'expo-home'),
      BROWSER: 'none',
      CI: '1',
      EXPO_NO_TELEMETRY: '1',
      EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK: ROUTER_REWRITE_DISABLED,
      ...env,
    },
  });
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
  const expoCli = await resolveAppOwnedExpoCliAsync(project.path);

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
      args: ['install', '--check'],
      command: expoCli,
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
  for (const platform of ['web', 'android', 'ios'] as const) {
    await runCommandAsync({
      args: [
        'export',
        '--platform',
        platform,
        ...(platform === 'web' ? [] : ['--output-dir', `dist-${platform}`]),
        '--clear',
      ],
      command: expoCli,
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
    await chrome.setViewportAsync(390, 844);
    await chrome.navigateAsync(rootUrl);
    await chrome.waitForBodyTextAsync('Navigation Home');
    await chrome.assertNoHorizontalOverflowAsync('served static export at mobile width');
    await chrome.clickByTestIdAsync('home-profile');
    await chrome.waitForLocationAsync({ pathname: '/profile/ada', search: '?source=internal' });
    await chrome.waitForBodyTextAsync('Dynamic Profile Route');
    await chrome.setViewportAsync(1440, 900);
    await chrome.assertNoHorizontalOverflowAsync('served static export at desktop width');
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

async function runGlobalStudioAuthNavigationSmokeAsync(
  projectRoot: string,
  studioApiUrl: string,
): Promise<void> {
  await runDevelopmentWebAsync(
    projectRoot,
    async (chrome, rootUrl) => {
      await chrome.installObservedBodyTextHistoryAsync();
      await chrome.installObservedPathnameHistoryAsync();
      await chrome.navigateAsync(rootUrl);
      await chrome.waitForLocationAsync({ pathname: '/sign-in' });
      await chrome.waitForBodyTextAsync('Sign in');
      if (await chrome.hasObservedPathnameAsync('/ankh')) {
        throw new Error('Global Auth cold start selected Studio administration during bootstrap.');
      }
      if (await chrome.hasObservedBodyTextAsync('Administration')) {
        throw new Error('Global Auth cold start rendered Studio administration during bootstrap.');
      }

      await chrome.clearLocalStorageAsync();
      await chrome.navigateAsync(`${rootUrl}/ankh/deploy`);
      await chrome.waitForLocationAsync({ pathname: '/sign-in' });
      const deniedBody = await chrome.waitForBodyTextAsync('Sign in');
      if (deniedBody.includes('Deployment administration')) {
        throw new Error('Signed-out direct Studio access rendered protected administration.');
      }

      await chrome.setLocalStorageItemAsync(
        'ankh.auth.session.v1',
        JSON.stringify({
          accessToken: 'expo57-navigation-acceptance-token',
          user: { id: 'expo57-navigation-acceptance-user' },
        }),
      );
      await chrome.navigateAsync(rootUrl);
      await chrome.waitForLocationAsync({ pathname: '/about' });
      await chrome.waitForBodyTextAsync('Static About Route');

      await chrome.navigateAsync(`${rootUrl}/ankh`);
      await chrome.waitForLocationAsync({ pathname: '/ankh' });
      await chrome.waitForBodyTextAsync('Administration');
      await chrome.clickByRoleAndNameAsync('button', 'Back to app');
      await chrome.waitForLocationAsync({ pathname: '/about' });
      await chrome.waitForBodyTextAsync('Static About Route');
      assertNoBrowserErrors(chrome.errors, 'global Auth Studio navigation');
    },
    { EXPO_PUBLIC_API_URL: studioApiUrl },
  );
}

async function runGlobalStudioAuthBypassNavigationSmokeAsync(
  projectRoot: string,
  studioApiUrl: string,
): Promise<void> {
  await runDevelopmentWebAsync(
    projectRoot,
    async (chrome, rootUrl) => {
      await chrome.navigateAsync(rootUrl);
      await chrome.clearLocalStorageAsync();
      await chrome.reloadAsync();
      await chrome.waitForLocationAsync({ pathname: '/about' });
      await chrome.waitForBodyTextAsync('Static About Route');

      await chrome.navigateAsync(`${rootUrl}/ankh`);
      await chrome.waitForLocationAsync({ pathname: '/ankh' });
      await chrome.waitForBodyTextAsync('Administration');
      assertNoBrowserErrors(chrome.errors, 'global Auth development bypass navigation');
    },
    {
      EXPO_PUBLIC_ANKH_AUTH_DISABLE_IN_DEV: 'true',
      EXPO_PUBLIC_API_URL: studioApiUrl,
    },
  );
}

async function runThemedRootStudioAuthNavigationSmokeAsync(
  project: NavigationProject,
  studioApiUrl: string,
): Promise<void> {
  const appLayout = await readFile(
    path.join(project.path, 'src', 'app', '(app)', '_layout.tsx'),
    'utf8',
  );
  if (!appLayout.includes('const { theme } = useZoraTheme();')) {
    throw new Error(`${project.id} does not exercise a themed root navigator.`);
  }

  await generateRouterTypesAsync(project);
  await assertRouterTypesAsync(project, ['about']);
  await runDevelopmentWebAsync(
    project.path,
    async (chrome, rootUrl) => {
      await chrome.navigateAsync(rootUrl);
      await chrome.waitForLocationAsync({ pathname: '/sign-in' });
      await chrome.waitForBodyTextAsync('Sign in');
      await chrome.setLocalStorageItemAsync(
        'ankh.auth.session.v1',
        JSON.stringify({
          accessToken: 'expo57-themed-root-acceptance-token',
          user: { id: 'expo57-themed-root-acceptance-user' },
        }),
      );
      await chrome.navigateAsync(rootUrl);
      await chrome.waitForLocationAsync({ pathname: '/about' });
      await chrome.waitForBodyTextAsync('Root Navigator About Route');
      await chrome.navigateAsync(`${rootUrl}/ankh`);
      await chrome.waitForLocationAsync({ pathname: '/ankh' });
      await chrome.waitForBodyTextAsync('Administration');
      assertNoBrowserErrors(chrome.errors, 'themed root global Auth Studio navigation');
    },
    { EXPO_PUBLIC_API_URL: studioApiUrl },
  );
}

async function runScopeAwareStudioChecksAsync(
  project: NavigationProject,
  studioApiUrl: string,
): Promise<void> {
  await generateRouterTypesAsync(project);
  await assertRouterTypesAsync(project);
  await runCommandAsync({
    args: ['run', 'typecheck'],
    command: 'bun',
    cwd: project.path,
    label: `${project.id} scope-aware Studio TypeScript`,
  });
  await runDevelopmentWebAsync(
    project.path,
    async (chrome, rootUrl) => {
      await chrome.navigateAsync(rootUrl);
      await chrome.waitForLocationAsync({ pathname: '/' });
      await chrome.waitForBodyTextAsync('Navigation Home');
      await chrome.navigateAsync(`${rootUrl}/ankh/deploy`);
      await chrome.waitForLocationAsync({ pathname: '/' });
      const bodyText = await chrome.waitForBodyTextAsync('Navigation Home');
      if (bodyText.includes('Deployment administration') || bodyText.includes('Administration')) {
        throw new Error(`${project.id} exposed Studio administration without a global session.`);
      }
      assertNoBrowserErrors(chrome.errors, `${project.id} public scope navigation`);
    },
    { EXPO_PUBLIC_API_URL: studioApiUrl },
  );
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
  readonly authScope?: 'global' | 'integrated' | 'none';
  readonly hideRootAboutRoute?: boolean;
  readonly id: string;
  readonly includeStudio: boolean;
  readonly name: string;
  readonly path: string;
  readonly postSignInRoute?: 'about' | 'index';
  readonly rootNavigator?: 'drawer' | 'tabs';
}
