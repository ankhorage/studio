import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { createServer as createHttpServer, type Server as HttpServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { AppManifest, UiNode } from '@ankhorage/contracts';
import { expect, test } from 'bun:test';
import type { FastifyInstance } from 'fastify';

import { startStudioHostServerWithSecrets } from './http/serverWithSecrets';
import { ModuleManager } from './orchestrator/moduleManager';
import { ProjectManager } from './orchestrator/projectManager';
import { getTemplateCatalog } from './templateRegistry';

const adminWebSmokeTest = process.env.ANKH_STUDIO_ADMIN_WEB_SMOKE === '1' ? test : test.skip;
const TEST_TIMEOUT_MS = 240_000;
const HTTP_TIMEOUT_MS = 120_000;
const ROUTE_SETTLE_MS = 1_500;

interface ChromeJsonTarget {
  readonly webSocketDebuggerUrl: string;
}

interface ChromeProtocolMessage {
  readonly id?: number;
  readonly method?: string;
  readonly params?: unknown;
  readonly result?: unknown;
  readonly error?: unknown;
}

interface ProtectedMountProbe {
  readonly url: string;
  readonly getRequestCount: () => number;
  readonly close: () => Promise<void>;
}

function createAdminSmokeManifest(): AppManifest {
  return {
    metadata: {
      name: 'Generated Admin Web Smoke',
      slug: 'generated-admin-web-smoke',
      version: '1.0.0',
      category: 'developer_tools',
      themeId: 'theme-1',
    },
    settings: { localization: { defaultLocale: 'en', locales: ['en'] } },
    infra: {
      plugins: [],
      auth: {
        scope: 'global',
        provider: 'supabase',
        flow: {
          signInRoute: 'sign-in',
          signUpRoute: 'sign-up',
          signOutRoute: 'sign-out',
          forgotPasswordRoute: 'forgot-password',
          postSignInRoute: 'dashboard',
          unauthorizedRoute: 'sign-in',
        },
        signIn: { identifiers: ['email'] },
        oauth: {
          enabled: false,
          callbackRoute: '/auth/callback',
          providers: [],
        },
      },
    },
    navigator: {
      type: 'stack',
      initialRouteName: 'dashboard',
      routes: [{ name: 'dashboard', label: 'Dashboard', screenId: 'dashboard' }],
    },
    screens: {
      dashboard: {
        id: 'dashboard',
        name: 'Dashboard',
        root: createScrollableRuntimeScreenRoot(),
      },
    },
    themes: [
      {
        id: 'theme-1',
        name: 'Smoke Theme',
        light: { primaryColor: '#2463eb', harmony: 'analogous' },
        dark: { primaryColor: '#f59e0b', harmony: 'triadic' },
      },
    ],
    activeThemeId: 'theme-1',
    activeThemeMode: 'light',
  };
}

function createScrollableRuntimeScreenRoot(): UiNode {
  return {
    id: 'dashboard-root',
    type: 'Screen',
    props: {
      scroll: true,
      width: 'wide',
    },
    children: [
      {
        id: 'dashboard-runtime-section',
        type: 'ScreenSection',
        props: {
          title: 'Scrollable Runtime Screen',
          description: 'Rendered through the generated-app runtime registry.',
        },
        children: Array.from({ length: 16 }, (_, index) => ({
          id: `dashboard-runtime-row-${index}`,
          type: 'Text',
          props: {
            children: `Generated runtime row ${index + 1}`,
          },
        })),
      },
    ],
  };
}

adminWebSmokeTest(
  'loads generated Studio admin routes through Expo web without a theme update loop',
  async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'ankh-admin-web-smoke-'));
    const hostPort = await reservePort();
    const debugPort = await reservePort();
    const expoPort = await reservePort();
    let studioHost: FastifyInstance | null = null;
    let protectedMountProbe: ProtectedMountProbe | null = null;
    let expoProcess: ChildProcessWithoutNullStreams | null = null;
    let chromeProcess: ChildProcessWithoutNullStreams | null = null;
    const expoOutput: string[] = [];

    try {
      const projectRoot = await createGeneratedAdminProject(workspaceRoot);
      const apiUrl = `http://127.0.0.1:${hostPort}/api`;
      await installFixtureAuthAdapter(projectRoot);
      await installFixtureAuthEntryRoute(projectRoot);
      protectedMountProbe = await startProtectedMountProbeServer();
      await installProtectedMountProbe(projectRoot, protectedMountProbe.url);
      const rootLayout = await readFile(
        path.join(projectRoot, 'src', 'app', '_layout.tsx'),
        'utf8',
      );
      expect(rootLayout).toContain('function GeneratedZoraThemeConfigSync');
      expect(rootLayout).toContain('lastSyncedThemeConfigSignatureRef');
      expect(rootLayout).not.toContain('}, [setThemeConfig, themeConfig]);');

      studioHost = await startStudioHostServerWithSecrets({
        projectRoot: workspaceRoot,
        port: hostPort,
        host: '127.0.0.1',
      });
      await waitForHttp(`${apiUrl}/projects`, HTTP_TIMEOUT_MS);

      expoProcess = spawnExpoWeb({ projectRoot, apiUrl, port: expoPort });
      collectProcessOutput(expoProcess, expoOutput);
      const appUrl = await waitForExpoWebUrl(expoOutput, HTTP_TIMEOUT_MS);

      const chromePath = resolveChromePath();
      chromeProcess = spawnChrome(chromePath, debugPort);
      const page = await openChromePage(debugPort);
      try {
        await page.navigate(`${appUrl}/dashboard?tab=activity`);
        await Bun.sleep(ROUTE_SETTLE_MS);
        await waitForLocation(page, (location) => location.includes('/sign-in'), HTTP_TIMEOUT_MS);
        const unauthenticatedBody = await page.readBodyText();
        expect(unauthenticatedBody).not.toContain('Scrollable Runtime Screen');
        expect(unauthenticatedBody).not.toContain('Generated runtime row 16');
        expect(protectedMountProbe.getRequestCount()).toBe(0);
        const pendingRedirect = await waitForStorageItem(
          page,
          'ankh.auth.pendingRedirect.v1',
          (value) => value?.includes('/dashboard?tab=activity') ?? false,
          HTTP_TIMEOUT_MS,
        );
        expect(pendingRedirect).toContain('/dashboard?tab=activity');

        await page.writeLocalStorageItem('ankh.auth.smokeSignIn', '1');
        await page.navigate(`${appUrl}/sign-in`);
        const restoredBodyText = await waitForBodyText(
          page,
          (text) => text.includes('Scrollable Runtime Screen'),
          HTTP_TIMEOUT_MS,
        );
        const restoredLocation = await page.readLocation();
        expect(restoredBodyText).toContain('Generated runtime row 16');
        expect(restoredLocation).toContain('/dashboard');
        expect(restoredLocation).toContain('tab=activity');
        expect(protectedMountProbe.getRequestCount()).toBeGreaterThan(0);

        for (const route of ['/', '/dashboard', '/ankh', '/ankh/theme', '/ankh/auth/providers']) {
          await page.navigate(`${appUrl}${route}`);
          await Bun.sleep(ROUTE_SETTLE_MS);
          const bodyText =
            route === '/dashboard'
              ? await waitForBodyText(
                  page,
                  (text) => text.includes('Scrollable Runtime Screen'),
                  HTTP_TIMEOUT_MS,
                )
              : await page.readBodyText();
          expect(bodyText).not.toContain('Maximum update depth exceeded');
          if (route === '/dashboard') {
            const diagnostics = [
              bodyText,
              await page.readLocation(),
              await page.readBodyHtml(),
              ...page.networkErrors,
              ...page.errors,
              formatProcessOutput(expoOutput),
            ].join('\n');
            expect(diagnostics).toContain('Scrollable Runtime Screen');
            expect(bodyText).toContain('Generated runtime row 16');
          }
          expect(page.errors.join('\n')).not.toContain('Maximum update depth exceeded');
          expect(page.errors.join('\n')).not.toContain('Cannot read properties of undefined');
        }
      } finally {
        page.close();
      }
    } finally {
      stopProcess(chromeProcess);
      stopProcess(expoProcess);
      await protectedMountProbe?.close();
      await studioHost?.close();
      await rm(workspaceRoot, { force: true, recursive: true });
    }
  },
  TEST_TIMEOUT_MS,
);

async function createGeneratedAdminProject(workspaceRoot: string): Promise<string> {
  await mkdir(path.join(workspaceRoot, 'apps', 'studio'), { recursive: true });
  await writeFile(
    path.join(workspaceRoot, 'package.json'),
    JSON.stringify({
      name: '@ankhorage/studio-admin-web-smoke',
      private: true,
      workspaces: ['apps/*'],
    }),
  );
  await linkSmokeNodeModules(workspaceRoot);

  const projectManager = new ProjectManager(workspaceRoot);
  const moduleManager = new ModuleManager(workspaceRoot);
  const template = getTemplateCatalog()
    .categories.find((candidate) => candidate.id === 'developer_tools')
    ?.templates.at(0);
  if (!template)
    throw new Error('Published templates package returned no developer-tools template.');

  const created = await projectManager.createProject(
    'Generated Admin Web Smoke',
    { category: 'developer_tools', templateId: template.templateId },
    (projectId) => moduleManager.generateModuleRegistry(projectId),
    { includeStudio: true },
  );

  await projectManager.saveStudioManifest({
    projectId: created.id,
    manifest: createAdminSmokeManifest(),
  });
  await moduleManager.syncProject({ projectId: created.id, includeStudio: true });
  await forceSinglePageWebOutput(created.path);
  await linkSmokeNodeModules(created.path);
  await linkLocalStudioPackage(created.path);
  await copyGeneratedDirectDependencies(created.path, workspaceRoot);
  await writeSmokeMetroConfig(created.path);

  return created.path;
}

async function installFixtureAuthEntryRoute(projectRoot: string): Promise<void> {
  await writeFile(
    path.join(projectRoot, 'src', 'app', '(auth)', 'sign-in.tsx'),
    `import type { AuthSession } from '@ankhorage/contracts/auth';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Platform, Text, View } from 'react-native';

import { setStoredAuthSession } from '@/auth/session';

function createFixtureSession(): AuthSession {
  return {
    accessToken: 'admin-web-smoke-access-token',
    expiresAt: Date.now() + 3600000,
    user: {
      id: 'admin-web-smoke-user',
      email: 'admin-web-smoke@example.test',
    },
  };
}

export default function FixtureSignInRoute() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (localStorage.getItem('ankh.auth.smokeSignIn') !== '1') return;
    localStorage.removeItem('ankh.auth.smokeSignIn');
    void setStoredAuthSession(createFixtureSession()).then(() => {
      location.reload();
    });
  }, []);

  return (
    <View>
      <Stack.Screen options={{ title: 'Sign in' }} />
      <Text>Sign in</Text>
    </View>
  );
}
`,
  );
}

async function installFixtureAuthAdapter(projectRoot: string): Promise<void> {
  await writeFile(
    path.join(projectRoot, 'src', 'auth', 'adapter.ts'),
    `import type { AuthAdapter, AuthSession } from '@ankhorage/contracts/auth';

function createFixtureSession(): AuthSession {
  return {
    accessToken: 'admin-web-smoke-access-token',
    expiresAt: Date.now() + 3600000,
    user: {
      id: 'admin-web-smoke-user',
      email: 'admin-web-smoke@example.test',
    },
  };
}

export const authAdapter: AuthAdapter = {
  capabilities: {
    signInIdentifiers: ['email'],
    supportsSignUp: true,
    supportsPasswordReset: false,
    supportsOtp: false,
    supportsSessionRefresh: false,
  },
  signIn: () => Promise.resolve({ ok: true, data: createFixtureSession() }),
  signUp: () => Promise.resolve({ ok: true, data: createFixtureSession() }),
  signOut: () => Promise.resolve({ ok: true, data: undefined }),
  getSession: () => Promise.resolve({ ok: true, data: null }),
  refreshSession: () => Promise.resolve({ ok: true, data: createFixtureSession() }),
};
`,
  );
}

async function installProtectedMountProbe(projectRoot: string, probeUrl: string): Promise<void> {
  const dashboardPath = path.join(projectRoot, 'src', 'app', '(app)', 'dashboard.tsx');
  const dashboardSource = await readFile(dashboardPath, 'utf8');
  const withImport = dashboardSource.replace(
    "import { useMemo } from 'react';",
    "import { useEffect, useMemo } from 'react';",
  );
  const withProbe = withImport.replace(
    '  const currentScreenId =',
    `  useEffect(() => {
    void fetch(${JSON.stringify(probeUrl)}).catch(() => undefined);
  }, []);

  const currentScreenId =`,
  );
  await writeFile(dashboardPath, withProbe);
}

async function forceSinglePageWebOutput(projectRoot: string): Promise<void> {
  const appConfigPath = path.join(projectRoot, 'app.config.ts');
  const appConfig = await readFile(appConfigPath, 'utf8');
  await writeFile(appConfigPath, appConfig.replace("output: 'static'", "output: 'single'"));
}

async function copyGeneratedDirectDependencies(
  projectRoot: string,
  workspaceRoot: string,
): Promise<void> {
  const packageJson = JSON.parse(
    await readFile(path.join(projectRoot, 'package.json'), 'utf8'),
  ) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const packageNames = [
    ...new Set([
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.devDependencies ?? {}),
      '@expo/metro-runtime',
      '@babel/runtime',
      '@react-navigation/native',
      'metro-runtime',
    ]),
  ];

  await Promise.all(
    packageNames
      .filter((packageName) => packageName !== '@ankhorage/studio')
      .map(async (packageName) => {
        await copyNodeModulePackage(packageName, path.join(workspaceRoot, 'node_modules'));
        await copyNodeModulePackage(packageName, path.join(projectRoot, 'node_modules'));
      }),
  );
}

async function linkLocalStudioPackage(projectRoot: string): Promise<void> {
  const targetScopeRoot = path.join(projectRoot, 'node_modules', '@ankhorage');
  await mkdir(targetScopeRoot, { recursive: true });
  await symlinkIfMissing(process.cwd(), path.join(targetScopeRoot, 'studio'));
}

async function writeSmokeMetroConfig(projectRoot: string): Promise<void> {
  await writeFile(
    path.join(projectRoot, 'metro.config.js'),
    `const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const studioRoot = ${JSON.stringify(process.cwd())};
const config = getDefaultConfig(__dirname);
config.resolver.disableHierarchicalLookup = true;
config.resolver.unstable_enableSymlinks = true;
config.resolver.emptyModulePath = path.resolve(
  __dirname,
  'node_modules/metro-runtime/src/modules/empty-module.js',
);
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, '../../node_modules'),
];
config.resolver.extraNodeModules = {
  react: path.resolve(__dirname, 'node_modules/react'),
  'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
  'react-native': path.resolve(__dirname, 'node_modules/react-native'),
  'react-native-web': path.resolve(__dirname, 'node_modules/react-native-web'),
};
config.watchFolders = [
  path.resolve(__dirname, '../..'),
  studioRoot,
];

module.exports = config;
`,
  );
}

async function reservePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createNetServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (typeof address === 'object' && address !== null) {
        const { port } = address;
        server.close(() => resolve(port));
        return;
      }
      server.close(() => reject(new Error('Could not reserve local port.')));
    });
  });
}

async function startProtectedMountProbeServer(): Promise<ProtectedMountProbe> {
  const port = await reservePort();
  let requestCount = 0;
  const server = createHttpServer((request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }
    requestCount += 1;
    response.writeHead(204);
    response.end();
  });

  await new Promise<void>((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });

  return {
    url: `http://127.0.0.1:${port}/protected-mounted`,
    getRequestCount: () => requestCount,
    close: () => closeHttpServer(server),
  };
}

function closeHttpServer(server: HttpServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function spawnExpoWeb(args: {
  readonly projectRoot: string;
  readonly apiUrl: string;
  readonly port: number;
}): ChildProcessWithoutNullStreams {
  const expoBin = path.join(process.cwd(), 'apps', 'studio', 'node_modules', '.bin', 'expo');
  return spawn(expoBin, ['start', '--web', '--localhost', '--port', String(args.port)], {
    cwd: args.projectRoot,
    env: {
      ...process.env,
      BROWSER: 'none',
      CI: '1',
      EXPO_NO_TELEMETRY: '1',
      EXPO_PUBLIC_API_URL: args.apiUrl,
      NODE_ENV: 'development',
    },
    detached: true,
  });
}

async function waitForExpoWebUrl(output: readonly string[], timeoutMs: number): Promise<string> {
  const start = Date.now();
  const urlPattern = /https?:\/\/(?:localhost|127\.0\.0\.1):\d+/gu;

  while (Date.now() - start < timeoutMs) {
    const match = output.join('').match(urlPattern)?.[0];
    if (match) return match.replace('localhost', '127.0.0.1');
    await Bun.sleep(500);
  }

  throw new Error(`Timed out waiting for Expo web URL.${formatProcessOutput(output)}`);
}

async function linkSmokeNodeModules(workspaceRoot: string): Promise<void> {
  const nodeModulesRoot = path.join(workspaceRoot, 'node_modules');
  await mkdir(nodeModulesRoot, { recursive: true });
  await linkNodeModuleEntries({
    sourceRoot: path.join(process.cwd(), 'apps', 'studio', 'node_modules'),
    targetRoot: nodeModulesRoot,
  });
  await linkNodeModuleEntries({
    sourceRoot: path.join(process.cwd(), 'node_modules', '.bun', 'node_modules'),
    targetRoot: nodeModulesRoot,
  });
  await copyNodeModuleEntry({
    sourceRoot: path.join(process.cwd(), 'node_modules', '.bun', 'node_modules'),
    targetRoot: nodeModulesRoot,
    packageName: 'expo-router',
  });
}

async function linkNodeModuleEntries(args: {
  readonly sourceRoot: string;
  readonly targetRoot: string;
  readonly packageNames?: readonly string[];
}): Promise<void> {
  const packageNames = args.packageNames ?? (await readdir(args.sourceRoot));
  for (const packageName of packageNames) {
    if (packageName.startsWith('.')) continue;
    if (packageName.startsWith('@') && packageName.includes('/')) {
      const [scopeName, scopedPackageName] = packageName.split('/');
      if (!scopeName || !scopedPackageName) {
        throw new Error(`Invalid scoped package name: ${packageName}`);
      }
      const targetScopeRoot = path.join(args.targetRoot, scopeName);
      await mkdir(targetScopeRoot, { recursive: true });
      await symlinkIfMissing(
        path.join(args.sourceRoot, scopeName, scopedPackageName),
        path.join(targetScopeRoot, scopedPackageName),
      );
      continue;
    }
    if (packageName.startsWith('@')) {
      await linkScopedNodeModuleEntries({
        sourceRoot: path.join(args.sourceRoot, packageName),
        targetRoot: path.join(args.targetRoot, packageName),
        scopeName: packageName,
      });
      continue;
    }

    await symlinkIfMissing(
      path.join(args.sourceRoot, packageName),
      path.join(args.targetRoot, packageName),
    );
  }
}

async function linkScopedNodeModuleEntries(args: {
  readonly sourceRoot: string;
  readonly targetRoot: string;
  readonly scopeName: string;
}): Promise<void> {
  await mkdir(args.targetRoot, { recursive: true });
  const packageNames = await readdir(args.sourceRoot);
  for (const packageName of packageNames) {
    await symlinkIfMissing(
      path.join(args.sourceRoot, packageName),
      path.join(args.targetRoot, packageName),
    );
  }
}

async function symlinkIfMissing(source: string, target: string): Promise<void> {
  try {
    await symlink(await realpath(source), target, 'dir');
  } catch (error) {
    if (isNodeErrorWithCode(error, 'EEXIST')) return;
    throw error;
  }
}

async function copyNodeModuleEntry(args: {
  readonly sourceRoot: string;
  readonly targetRoot: string;
  readonly packageName: string;
}): Promise<void> {
  const source = await realpath(path.join(args.sourceRoot, args.packageName));
  const target = path.join(args.targetRoot, args.packageName);
  await rm(target, { force: true, recursive: true });
  await cp(source, target, { recursive: true });
}

async function copyNodeModulePackage(packageName: string, targetRoot: string): Promise<void> {
  const source = await resolveSmokeNodeModuleSource(packageName);
  const target = getNodeModuleTargetPath(targetRoot, packageName);
  await mkdir(path.dirname(target), { recursive: true });
  await rm(target, { force: true, recursive: true });
  await cp(source, target, { recursive: true });
}

async function resolveSmokeNodeModuleSource(packageName: string): Promise<string> {
  const candidateRoots = [
    path.join(process.cwd(), 'node_modules', '.bun', 'node_modules'),
    path.join(process.cwd(), 'apps', 'studio', 'node_modules'),
  ];
  for (const candidateRoot of candidateRoots) {
    const candidate = getNodeModuleTargetPath(candidateRoot, packageName);
    try {
      return await realpath(candidate);
    } catch {
      continue;
    }
  }

  throw new Error(`Could not resolve smoke node module ${packageName}.`);
}

function getNodeModuleTargetPath(root: string, packageName: string): string {
  if (packageName.startsWith('@')) {
    const [scopeName, scopedPackageName] = packageName.split('/');
    if (!scopeName || !scopedPackageName) {
      throw new Error(`Invalid scoped package name: ${packageName}`);
    }
    return path.join(root, scopeName, scopedPackageName);
  }

  return path.join(root, packageName);
}

function isNodeErrorWithCode(error: unknown, code: string): boolean {
  return isRecord(error) && error.code === code;
}

async function waitForHttp(
  url: string,
  timeoutMs: number,
  getDiagnostics: () => string = () => '',
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      await Bun.sleep(500);
    }
  }
  throw new Error(`Timed out waiting for ${url}.${getDiagnostics()}`);
}

async function waitForBodyText(
  page: ChromePage,
  predicate: (bodyText: string) => boolean,
  timeoutMs: number,
): Promise<string> {
  const start = Date.now();
  let bodyText = '';

  while (Date.now() - start < timeoutMs) {
    bodyText = await page.readBodyText();
    if (predicate(bodyText)) return bodyText;
    await Bun.sleep(500);
  }

  throw new Error(
    [
      'Timed out waiting for body text.',
      `Location: ${await page.readLocation()}`,
      `Body: ${bodyText}`,
      `HTML: ${await page.readBodyHtml()}`,
      `Browser errors: ${page.errors.join('\n')}`,
      `Network errors: ${page.networkErrors.join('\n')}`,
    ].join('\n'),
  );
}

async function waitForLocation(
  page: ChromePage,
  predicate: (location: string) => boolean,
  timeoutMs: number,
): Promise<string> {
  const start = Date.now();
  let location = '';

  while (Date.now() - start < timeoutMs) {
    location = await page.readLocation();
    if (predicate(location)) return location;
    await Bun.sleep(500);
  }

  return location;
}

async function waitForStorageItem(
  page: ChromePage,
  key: string,
  predicate: (value: string | null) => boolean,
  timeoutMs: number,
): Promise<string> {
  const start = Date.now();
  let value: string | null = null;

  while (Date.now() - start < timeoutMs) {
    value = await page.readLocalStorageItem(key);
    if (predicate(value) && value !== null) return value;
    await Bun.sleep(500);
  }

  throw new Error(
    `Timed out waiting for localStorage item ${key}. Last value: ${JSON.stringify(
      value,
    )}. Location: ${await page.readLocation()}. Body: ${await page.readBodyText()}`,
  );
}

function resolveChromePath(): string {
  const configured = readEnvString('CHROME_PATH');
  if (configured) return configured;
  return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
}

function readEnvString(name: string): string | undefined {
  const env = process.env as Record<string, string | undefined>;
  const value = env[name];
  return typeof value === 'string' ? value : undefined;
}

function spawnChrome(chromePath: string, debugPort: number): ChildProcessWithoutNullStreams {
  return spawn(
    chromePath,
    [
      '--headless=new',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${path.join(tmpdir(), `ankh-admin-web-chrome-${debugPort}`)}`,
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank',
    ],
    { detached: true },
  );
}

async function openChromePage(debugPort: number): Promise<ChromePage> {
  await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`, HTTP_TIMEOUT_MS);
  const response = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, {
    method: 'PUT',
  });
  const target = (await response.json()) as ChromeJsonTarget;
  const page = new ChromePage(target.webSocketDebuggerUrl);
  await page.ready;
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('Log.enable');
  await page.send('Network.enable');
  return page;
}

class ChromePage {
  readonly errors: string[] = [];
  readonly networkErrors: string[] = [];
  readonly ready: Promise<void>;
  private nextId = 1;
  private readonly pending = new Map<
    number,
    {
      readonly resolve: (value: unknown) => void;
      readonly reject: (error: Error) => void;
    }
  >();
  private readonly socket: WebSocket;

  constructor(url: string) {
    this.socket = new WebSocket(url);
    this.ready = new Promise((resolve, reject) => {
      this.socket.onopen = () => resolve();
      this.socket.onerror = () => reject(new Error('Chrome DevTools socket failed to open.'));
    });
    this.socket.onmessage = (event) => this.handleMessage(event.data);
  }

  async navigate(url: string): Promise<void> {
    await this.send('Page.navigate', { url });
    await this.waitForLoad();
  }

  async reload(): Promise<void> {
    await this.send('Page.reload', { ignoreCache: true });
    await this.waitForLoad();
  }

  async submitSignInForm(email: string, password: string): Promise<void> {
    await this.focusSignInInput(0);
    await this.send('Input.insertText', { text: email });
    await this.focusSignInInput(1);
    await this.send('Input.insertText', { text: password });

    const result = await this.send('Runtime.evaluate', {
      expression: `(() => {
        const signInButton = [...document.querySelectorAll('button, [role="button"]')]
          .find((element) => (element.textContent ?? '').trim() === 'Sign in');
        if (!(signInButton instanceof HTMLElement)) {
          throw new Error('Generated sign-in submit button was not found.');
        }
        setTimeout(() => signInButton.click(), 0);
        return true;
      })()`,
      returnByValue: true,
    });
    if (!isRecord(result) || isRecord(result.exceptionDetails)) {
      throw new Error(`Failed to submit generated sign-in form: ${JSON.stringify(result)}`);
    }
  }

  private async focusSignInInput(index: number): Promise<void> {
    const result = await this.send('Runtime.evaluate', {
      expression: `(() => {
        const inputs = [...document.querySelectorAll('input')];
        const input = inputs[${index}];
        if (!(input instanceof HTMLInputElement)) {
          throw new Error('Generated sign-in input ${index} was not found.');
        }
        input.focus();
        return true;
      })()`,
      returnByValue: true,
    });
    if (!isRecord(result) || isRecord(result.exceptionDetails)) {
      throw new Error(
        `Failed to focus generated sign-in input ${index}: ${JSON.stringify(result)}`,
      );
    }
  }

  async readBodyText(): Promise<string> {
    const result = await this.send('Runtime.evaluate', {
      expression: 'document.body?.innerText ?? ""',
      returnByValue: true,
    });
    if (!isRecord(result)) return '';
    const nestedResult = result.result;
    if (!isRecord(nestedResult)) return '';
    const { value } = nestedResult;
    return typeof value === 'string' ? value : '';
  }

  async readBodyHtml(): Promise<string> {
    const result = await this.send('Runtime.evaluate', {
      expression: 'document.body?.innerHTML ?? ""',
      returnByValue: true,
    });
    if (!isRecord(result)) return '';
    const nestedResult = result.result;
    if (!isRecord(nestedResult)) return '';
    const { value } = nestedResult;
    return typeof value === 'string' ? value : '';
  }

  async readLocation(): Promise<string> {
    const result = await this.send('Runtime.evaluate', {
      expression: 'location.href',
      returnByValue: true,
    });
    if (!isRecord(result)) return '';
    const nestedResult = result.result;
    if (!isRecord(nestedResult)) return '';
    const { value } = nestedResult;
    return typeof value === 'string' ? value : '';
  }

  async readLocalStorageItem(key: string): Promise<string | null> {
    const result = await this.send('Runtime.evaluate', {
      expression: `localStorage.getItem(${JSON.stringify(key)})`,
      returnByValue: true,
    });
    if (!isRecord(result)) return null;
    const nestedResult = result.result;
    if (!isRecord(nestedResult)) return null;
    const { value } = nestedResult;
    return typeof value === 'string' ? value : null;
  }

  async writeLocalStorageItem(key: string, value: string): Promise<void> {
    await this.send('Runtime.evaluate', {
      expression: `localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(value)})`,
      returnByValue: true,
    });
  }

  send(method: string, params?: Readonly<Record<string, unknown>>): Promise<unknown> {
    const id = this.nextId;
    this.nextId += 1;
    const message = JSON.stringify(params ? { id, method, params } : { id, method });
    const promise = new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.socket.send(message);
    return promise;
  }

  close(): void {
    this.socket.close();
  }

  private waitForLoad(): Promise<void> {
    return new Promise((resolve) => {
      const timeout = setTimeout(resolve, 10_000);
      const previousMessageHandler = this.socket.onmessage;
      this.socket.onmessage = (event) => {
        this.handleMessage(event.data);
        const message = parseChromeProtocolMessage(event.data);
        if (message?.method === 'Page.loadEventFired') {
          clearTimeout(timeout);
          this.socket.onmessage = previousMessageHandler;
          resolve();
        }
      };
    });
  }

  private handleMessage(data: unknown): void {
    const message = parseChromeProtocolMessage(data);
    if (!message) return;

    if (message.id !== undefined) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(JSON.stringify(message.error)));
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    if (message.method === 'Runtime.exceptionThrown' || message.method === 'Log.entryAdded') {
      this.errors.push(JSON.stringify(message.params));
      return;
    }

    if (message.method === 'Network.loadingFailed') {
      this.networkErrors.push(JSON.stringify(message.params));
    }
  }
}

function parseChromeProtocolMessage(data: unknown): ChromeProtocolMessage | null {
  const text =
    typeof data === 'string' ? data : data instanceof Buffer ? data.toString('utf8') : '';
  if (!text) return null;
  const parsed = JSON.parse(text) as unknown;
  if (!isRecord(parsed)) return null;
  return {
    ...(typeof parsed.id === 'number' ? { id: parsed.id } : {}),
    ...(typeof parsed.method === 'string' ? { method: parsed.method } : {}),
    ...('params' in parsed ? { params: parsed.params } : {}),
    ...('result' in parsed ? { result: parsed.result } : {}),
    ...('error' in parsed ? { error: parsed.error } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stopProcess(processToStop: ChildProcessWithoutNullStreams | null): void {
  if (!processToStop?.pid) return;
  try {
    globalThis.process.kill(-processToStop.pid, 'SIGTERM');
  } catch {
    processToStop.kill('SIGTERM');
  }
}

function collectProcessOutput(
  processToCollect: ChildProcessWithoutNullStreams,
  output: string[],
): void {
  processToCollect.stdout.on('data', (chunk: Buffer) => output.push(chunk.toString('utf8')));
  processToCollect.stderr.on('data', (chunk: Buffer) => output.push(chunk.toString('utf8')));
  processToCollect.on('exit', (code, signal) => {
    output.push(`\n[process exited code=${code ?? 'null'} signal=${signal ?? 'null'}]\n`);
  });
}

function formatProcessOutput(output: readonly string[]): string {
  const text = output.join('');
  if (!text) return '';
  return `\nProcess output:\n${text.slice(-8_000)}`;
}
