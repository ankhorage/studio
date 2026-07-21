import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, test } from 'bun:test';

import { getTemplateCatalog } from './templateRegistry';

const studioWorkspaceWebSmokeTest =
  process.env.ANKH_STUDIO_WORKSPACE_WEB_SMOKE === '1' ? test : test.skip;
const HTTP_TIMEOUT_MS = 120_000;
const ROUTE_SETTLE_MS = 1_500;
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
  'renders Studio workspace routes through Expo web',
  async () => {
    const debugPort = await reservePort();
    const expoPort = await reservePort();
    let expoProcess: ChildProcessWithoutNullStreams | null = null;
    let chromeProcess: ChildProcessWithoutNullStreams | null = null;
    const expoOutput: string[] = [];

    try {
      const category = getTemplateCatalog().categories.find((entry) => entry.templates.length > 0);
      const [template] = category?.templates ?? [];
      if (category === undefined || template === undefined) {
        throw new Error('Published templates package returned no templates.');
      }

      expoProcess = spawnStudioExpoWeb(expoPort);
      collectProcessOutput(expoProcess, expoOutput);
      const appUrl = await waitForExpoWebUrl(expoOutput, HTTP_TIMEOUT_MS);

      chromeProcess = spawnChrome(resolveChromePath(), debugPort);
      const page = await openChromePage(debugPort);
      try {
        for (const route of [
          '/',
          '/create',
          `/create/${category.id}`,
          `/create/${category.id}/${template.templateId}`,
          '/projects/studio',
          '/create/not-a-category',
          `/create/${category.id}/not-a-template`,
        ]) {
          await page.navigate(`${appUrl}${route}`);
          await Bun.sleep(ROUTE_SETTLE_MS);
          const bodyText = await page.readBodyText();
          expect(bodyText).not.toContain('Maximum update depth exceeded');
          expect(bodyText).not.toContain('Cannot read properties of undefined');
          expect(page.errors.join('\n')).not.toContain('Maximum update depth exceeded');
        }
      } finally {
        page.close();
      }
    } finally {
      stopProcess(chromeProcess);
      stopProcess(expoProcess);
    }
  },
  TEST_TIMEOUT_MS,
);

function spawnStudioExpoWeb(port: number): ChildProcessWithoutNullStreams {
  return spawn('bun', ['run', '--cwd', 'apps/studio', 'web', '--', '--port', String(port)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      BROWSER: 'none',
      CI: '1',
      EXPO_NO_TELEMETRY: '1',
      NODE_ENV: 'development',
    },
    detached: true,
  });
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

function resolveChromePath(): string {
  const configured = (process.env as Record<string, string | undefined>).CHROME_PATH;
  if (configured) return configured;
  return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
}

function spawnChrome(chromePath: string, debugPort: number): ChildProcessWithoutNullStreams {
  return spawn(
    chromePath,
    [
      '--headless=new',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${path.join(tmpdir(), `ankh-studio-workspace-chrome-${debugPort}`)}`,
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

async function waitForHttp(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      await Bun.sleep(500);
    }
  }
  throw new Error(`Timed out waiting for ${url}.`);
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
