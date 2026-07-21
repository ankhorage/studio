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
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { AppManifest } from '@ankhorage/contracts';
import { expect, test } from 'bun:test';

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

function createAdminSmokeManifest(): AppManifest {
  return {
    metadata: {
      name: 'Generated Admin Web Smoke',
      slug: 'generated-admin-web-smoke',
      version: '1.0.0',
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
        root: {
          id: 'dashboard-root',
          type: 'Page',
          props: { title: 'Dashboard' },
        },
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

adminWebSmokeTest(
  'loads generated Studio admin routes through Expo web without a theme update loop',
  async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'ankh-admin-web-smoke-'));
    const debugPort = await reservePort();
    let expoProcess: ChildProcessWithoutNullStreams | null = null;
    let chromeProcess: ChildProcessWithoutNullStreams | null = null;
    const expoOutput: string[] = [];

    try {
      const projectRoot = await createGeneratedAdminProject(workspaceRoot);
      const rootLayout = await readFile(
        path.join(projectRoot, 'src', 'app', '_layout.tsx'),
        'utf8',
      );
      expect(rootLayout).toContain('function GeneratedZoraThemeConfigSync');
      expect(rootLayout).toContain('lastSyncedThemeConfigSignatureRef');
      expect(rootLayout).not.toContain('}, [setThemeConfig, themeConfig]);');

      expoProcess = spawnExpoWeb(projectRoot);
      collectProcessOutput(expoProcess, expoOutput);
      const appUrl = await waitForExpoWebUrl(expoOutput, HTTP_TIMEOUT_MS);

      const chromePath = resolveChromePath();
      chromeProcess = spawnChrome(chromePath, debugPort);
      const page = await openChromePage(debugPort);
      try {
        for (const route of ['/', '/ankh', '/ankh/theme', '/ankh/auth/providers']) {
          await page.navigate(`${appUrl}${route}`);
          await Bun.sleep(ROUTE_SETTLE_MS);
          expect(await page.readBodyText()).not.toContain('Maximum update depth exceeded');
          expect(page.errors.join('\n')).not.toContain('Maximum update depth exceeded');
          expect(page.errors.join('\n')).not.toContain('Cannot read properties of undefined');
        }
      } finally {
        page.close();
      }
    } finally {
      stopProcess(chromeProcess);
      stopProcess(expoProcess);
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
  await linkSmokeNodeModules(created.path);
  await copyGeneratedDirectDependencies(created.path, workspaceRoot);
  await writeSmokeMetroConfig(created.path);

  return created.path;
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

async function writeSmokeMetroConfig(projectRoot: string): Promise<void> {
  await writeFile(
    path.join(projectRoot, 'metro.config.js'),
    `const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.unstable_enableSymlinks = true;
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, '../../node_modules'),
];

module.exports = config;
`,
  );
}

async function reservePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
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

function spawnExpoWeb(projectRoot: string): ChildProcessWithoutNullStreams {
  const expoBin = path.join(process.cwd(), 'apps', 'studio', 'node_modules', '.bin', 'expo');
  return spawn(expoBin, ['start', '--web', '--localhost'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      BROWSER: 'none',
      CI: '1',
      EXPO_NO_TELEMETRY: '1',
      EXPO_PUBLIC_ANKH_AUTH_DISABLE_IN_DEV: 'true',
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
  return page;
}

class ChromePage {
  readonly errors: string[] = [];
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
