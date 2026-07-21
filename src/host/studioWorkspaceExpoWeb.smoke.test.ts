import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { AppManifest } from '@ankhorage/contracts';
import { expect, test } from 'bun:test';
import type { FastifyInstance } from 'fastify';

import { startStudioHostServerWithSecrets } from './http/serverWithSecrets';
import { getTemplateCatalog } from './templateRegistry';

const studioWorkspaceWebSmokeTest =
  process.env.ANKH_STUDIO_WORKSPACE_WEB_SMOKE === '1' ? test : test.skip;
const FIXTURE_PROJECT_ID = 'release-monitor';
const FIXTURE_PROJECT_NAME = 'Release Monitor';
const HTTP_TIMEOUT_MS = 120_000;
const ROUTE_SETTLE_MS = 500;
const TEST_TIMEOUT_MS = 240_000;

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

studioWorkspaceWebSmokeTest(
  'renders Studio workspace routes through Expo web against a fixture-backed host',
  async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'ankh-studio-workspace-smoke-'));
    const hostPort = await reservePort();
    const debugPort = await reservePort();
    const expoPort = await reservePort();
    let studioHost: FastifyInstance | null = null;
    let expoProcess: ChildProcessWithoutNullStreams | null = null;
    let chromeProcess: ChildProcessWithoutNullStreams | null = null;
    const expoOutput: string[] = [];
    const appUrl = `http://127.0.0.1:${expoPort}`;

    try {
      const { category, template } = getSmokeTemplateSelection();
      await createSmokeWorkspaceFixture(workspaceRoot, category.id);

      studioHost = await startStudioHostServerWithSecrets({
        projectRoot: workspaceRoot,
        port: hostPort,
        host: '127.0.0.1',
      });
      await waitForHttp(`http://127.0.0.1:${hostPort}/api/projects`, HTTP_TIMEOUT_MS);

      expoProcess = spawnStudioExpoWeb({
        apiUrl: `http://127.0.0.1:${hostPort}/api`,
        port: expoPort,
      });
      collectProcessOutput(expoProcess, expoOutput);
      await waitForHttp(appUrl, HTTP_TIMEOUT_MS, () => formatProcessOutput(expoOutput));

      chromeProcess = spawnChrome(await resolveChromePath(), debugPort);
      const page = await openChromePage(debugPort);
      try {
        await expectRouteText(page, `${appUrl}/`, [
          'Projects',
          FIXTURE_PROJECT_NAME,
          'New project',
        ]);

        await expectRouteText(page, `${appUrl}/create`, ['New Project', category.label]);

        await expectRouteText(page, `${appUrl}/create/${category.id}`, [
          category.label,
          template.name,
        ]);

        await expectRouteText(page, `${appUrl}/create/${category.id}/${template.templateId}`, [
          'Create Project',
          template.name,
          'Project name',
        ]);

        await expectRouteText(page, `${appUrl}/projects/${FIXTURE_PROJECT_ID}`, [
          'Project Detail',
          FIXTURE_PROJECT_NAME,
          'Sync',
          'Infrastructure Up',
          'Open running app',
          'Delete project',
        ]);

        await expectRouteText(page, `${appUrl}/create/not-a-category`, [
          'Category not found',
          'not-a-category',
        ]);

        await expectRouteText(page, `${appUrl}/create/${category.id}/not-a-template`, [
          'Template not found',
        ]);
      } finally {
        page.close();
      }
    } finally {
      stopProcess(chromeProcess);
      stopProcess(expoProcess);
      await studioHost?.close();
      await rm(workspaceRoot, { force: true, recursive: true });
    }
  },
  TEST_TIMEOUT_MS,
);

function getSmokeTemplateSelection() {
  const category = getTemplateCatalog().categories.find((entry) => entry.templates.length > 0);
  const [template] = category?.templates ?? [];
  if (category === undefined || template === undefined) {
    throw new Error('Published templates package returned no templates.');
  }
  return { category, template };
}

async function createSmokeWorkspaceFixture(
  workspaceRoot: string,
  category: AppManifest['metadata']['category'],
): Promise<void> {
  const projectRoot = path.join(workspaceRoot, 'apps', FIXTURE_PROJECT_ID);
  await mkdir(projectRoot, { recursive: true });
  await writeFile(
    path.join(workspaceRoot, 'package.json'),
    JSON.stringify({
      name: '@ankhorage/studio-workspace-web-smoke',
      private: true,
      workspaces: ['apps/*'],
    }),
  );
  await writeFile(
    path.join(projectRoot, 'package.json'),
    JSON.stringify({
      name: FIXTURE_PROJECT_ID,
      version: '1.0.0',
      private: true,
    }),
  );
  await writeFile(
    path.join(projectRoot, 'ankh.config.json'),
    JSON.stringify(createSmokeManifest(category), null, 2),
  );
}

function createSmokeManifest(category: AppManifest['metadata']['category']): AppManifest {
  return {
    metadata: {
      name: FIXTURE_PROJECT_NAME,
      slug: FIXTURE_PROJECT_ID,
      version: '1.0.0',
      category,
      themeId: 'smoke-theme',
      created: '2026-01-01T00:00:00.000Z',
      updated: '2026-01-02T00:00:00.000Z',
    },
    themes: [
      {
        id: 'smoke-theme',
        name: 'Smoke Theme',
        light: { primaryColor: '#2563eb', harmony: 'analogous' },
        dark: { primaryColor: '#60a5fa', harmony: 'analogous' },
      },
    ],
    activeThemeId: 'smoke-theme',
    activeThemeMode: 'light',
    infra: {
      plugins: [],
      deployment: { target: 'minikube', monitoring: false },
      storage: { provider: 'auto', buckets: ['public'] },
      networking: { cdn: false },
    },
    navigator: {
      type: 'stack',
      initialRouteName: 'index',
      routes: [{ name: 'index', label: 'Overview', screenId: 'index' }],
    },
    screens: {
      index: {
        id: 'index',
        name: 'Overview',
        root: {
          id: 'index-root',
          type: 'Page',
          props: { title: FIXTURE_PROJECT_NAME },
        },
      },
    },
    settings: { localization: { defaultLocale: 'en', locales: ['en'] } },
  };
}

function spawnStudioExpoWeb(args: {
  readonly apiUrl: string;
  readonly port: number;
}): ChildProcessWithoutNullStreams {
  return spawn('bun', ['run', '--cwd', 'apps/studio', 'web', '--', '--port', String(args.port)], {
    cwd: process.cwd(),
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

async function expectRouteText(
  page: ChromePage,
  url: string,
  expectedTexts: readonly string[],
): Promise<void> {
  await page.navigate(url);
  const bodyText = await page.waitForBodyText(
    (text) => expectedTexts.every((expected) => text.includes(expected)),
    HTTP_TIMEOUT_MS,
  );
  expect(bodyText).not.toContain('Host connection failed');
  expect(bodyText).not.toContain('Catalog load failed');
  expect(bodyText).not.toContain('Maximum update depth exceeded');
  expect(bodyText).not.toContain('Cannot read properties of undefined');
  expect(page.errors.join('\n')).not.toContain('Maximum update depth exceeded');
  for (const expectedText of expectedTexts) {
    expect(bodyText).toContain(expectedText);
  }
  await Bun.sleep(ROUTE_SETTLE_MS);
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

async function resolveChromePath(): Promise<string> {
  const configured = (process.env as Record<string, string | undefined>).CHROME_PATH;
  const candidates = [
    configured,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ].filter(
    (candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0,
  );

  for (const candidate of candidates) {
    if (await canAccess(candidate)) return candidate;
  }

  throw new Error(
    `Could not resolve a Chrome or Chromium executable. Set CHROME_PATH or install google-chrome/chromium.`,
  );
}

async function canAccess(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function spawnChrome(chromePath: string, debugPort: number): ChildProcessWithoutNullStreams {
  return spawn(
    chromePath,
    [
      '--headless=new',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${path.join(tmpdir(), `ankh-studio-workspace-chrome-${debugPort}`)}`,
      '--disable-gpu',
      '--no-sandbox',
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

  async waitForBodyText(predicate: (text: string) => boolean, timeoutMs: number): Promise<string> {
    const start = Date.now();
    let text = '';
    while (Date.now() - start < timeoutMs) {
      text = await this.readBodyText();
      if (predicate(text)) return text;
      await Bun.sleep(250);
    }

    throw new Error(`Timed out waiting for route text. Last body text:\n${text}`);
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

function stopProcess(processToStop: ChildProcessWithoutNullStreams | null): void {
  if (!processToStop?.pid) return;
  try {
    globalThis.process.kill(-processToStop.pid, 'SIGTERM');
  } catch {
    processToStop.kill('SIGTERM');
  }
}

function formatProcessOutput(output: readonly string[]): string {
  const text = output.join('');
  if (!text) return '';
  return `\nProcess output:\n${text.slice(-8_000)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
