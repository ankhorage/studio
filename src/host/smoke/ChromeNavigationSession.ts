import { type ChildProcess, spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { getChromeNavigationIssue } from './getChromeNavigationIssue';

const HTTP_TIMEOUT_MS = 120_000;

export class ChromeNavigationSession {
  readonly errors: string[] = [];
  private nextId = 1;
  private readonly pending = new Map<
    number,
    {
      readonly reject: (error: Error) => void;
      readonly resolve: (value: unknown) => void;
    }
  >();
  private readonly process: ChildProcess;
  private readonly socket: WebSocket;

  static async createAsync(debugPort: number): Promise<ChromeNavigationSession> {
    const chromePath = await resolveChromePathAsync();
    const process = spawn(
      chromePath,
      [
        '--headless=new',
        `--remote-debugging-port=${debugPort}`,
        `--user-data-dir=${path.join(tmpdir(), `ankh-navigation-chrome-${debugPort}`)}`,
        '--disable-gpu',
        '--no-sandbox',
        '--no-first-run',
        '--no-default-browser-check',
        'about:blank',
      ],
      { detached: true, stdio: 'ignore' },
    );

    try {
      await waitForHttpAsync(`http://127.0.0.1:${debugPort}/json/version`, HTTP_TIMEOUT_MS);
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, {
        method: 'PUT',
      });
      if (!response.ok) throw new Error(`Chrome page creation failed with ${response.status}.`);
      const target = (await response.json()) as { readonly webSocketDebuggerUrl?: unknown };
      if (typeof target.webSocketDebuggerUrl !== 'string') {
        throw new Error('Chrome page creation did not return a debugger URL.');
      }

      const socket = new WebSocket(target.webSocketDebuggerUrl);
      const session = new ChromeNavigationSession(process, socket);
      await session.waitForSocketAsync();
      await session.sendAsync('Page.enable');
      await session.sendAsync('Runtime.enable');
      await session.sendAsync('Log.enable');
      await session.sendAsync('Page.addScriptToEvaluateOnNewDocument', {
        source: `window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason instanceof Error ? event.reason.stack ?? event.reason.message : String(event.reason);
  console.error('[unhandledrejection]', reason);
});`,
      });
      return session;
    } catch (error) {
      stopProcess(process);
      throw error;
    }
  }

  private constructor(process: ChildProcess, socket: WebSocket) {
    this.process = process;
    this.socket = socket;
    this.socket.onmessage = (event) => this.handleMessage(event.data);
  }

  async clearLocalStorageAsync(): Promise<void> {
    await this.evaluateAsync('(() => { localStorage.clear(); return true; })()');
  }

  async clickByRoleAndNameAsync(role: string, name: string): Promise<void> {
    const expression = createRoleAndNameExpression(role, name, {
      click: true,
      requireHydration: true,
    });
    await this.waitForBooleanAsync(expression, `${role} named "${name}" to become clickable`);
  }

  async clickByTestIdAsync(testId: string): Promise<void> {
    const expression = `(() => {
  const hasHydratedClickHandler = (element) => {
    const propsKey = Object.keys(element).find((key) => key.startsWith('__reactProps$'));
    return propsKey !== undefined && typeof element[propsKey]?.onClick === 'function';
  };
  const element = [...document.querySelectorAll('[data-testid]')].find(
    (candidate) => candidate.getAttribute('data-testid') === ${JSON.stringify(testId)},
  );
  if (!(element instanceof HTMLElement)) return false;
  const control = element.closest('[role="button"]') ?? element;
  if (!(control instanceof HTMLElement) || !hasHydratedClickHandler(control)) return false;
  control.click();
  return true;
})()`;
    await this.waitForBooleanAsync(expression, `testID "${testId}" to become clickable`);
  }

  close(): void {
    this.socket.close();
    stopProcess(this.process);
  }

  async goBackAsync(): Promise<void> {
    await this.evaluateAsync('(() => { history.back(); return true; })()');
  }

  async goForwardAsync(): Promise<void> {
    await this.evaluateAsync('(() => { history.forward(); return true; })()');
  }

  async hasRoleAndNameAsync(role: string, name: string): Promise<boolean> {
    return this.evaluateAsync<boolean>(
      createRoleAndNameExpression(role, name, { click: false, requireHydration: false }),
    );
  }

  async navigateAsync(url: string): Promise<void> {
    await this.sendAsync('Page.navigate', { url });
    await this.waitForLoadAsync();
  }

  async reloadAsync(): Promise<void> {
    await this.sendAsync('Page.reload');
    await this.waitForLoadAsync();
  }

  async setLocalStorageItemAsync(key: string, value: string): Promise<void> {
    await this.evaluateAsync(
      `(() => { localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(value)}); return true; })()`,
    );
  }

  async waitForHydratedRoleAndNameAsync(role: string, name: string): Promise<void> {
    const expression = createRoleAndNameExpression(role, name, {
      click: false,
      requireHydration: true,
    });
    await this.waitForBooleanAsync(expression, `hydrated ${role} named "${name}"`);
  }

  async waitForHydratedTestIdAsync(testId: string): Promise<void> {
    const expression = `(() => {
  const element = [...document.querySelectorAll('[data-testid]')].find(
    (candidate) => candidate.getAttribute('data-testid') === ${JSON.stringify(testId)},
  );
  if (!(element instanceof HTMLElement)) return false;
  return Object.keys(element).some(
    (key) => key.startsWith('__reactProps$') || key.startsWith('__reactFiber$'),
  );
})()`;
    await this.waitForBooleanAsync(expression, `testID "${testId}" to hydrate`);
  }

  async waitForBodyTextAsync(expectedText: string, timeoutMs = HTTP_TIMEOUT_MS): Promise<string> {
    const start = Date.now();
    let bodyText = '';
    while (Date.now() - start < timeoutMs) {
      bodyText = await this.evaluateAsync<string>('document.body?.innerText ?? ""');
      if (bodyText.includes(expectedText)) return bodyText;
      await Bun.sleep(250);
    }
    throw new Error(
      `Timed out waiting for body text "${expectedText}". Last body text:\n${bodyText}`,
    );
  }

  async waitForLocationAsync(
    expected: { readonly pathname: string; readonly search?: string },
    timeoutMs = HTTP_TIMEOUT_MS,
  ): Promise<void> {
    const start = Date.now();
    let observed = { pathname: '', search: '' };
    while (Date.now() - start < timeoutMs) {
      observed = await this.evaluateAsync<{ pathname: string; search: string }>(
        '({ pathname: location.pathname, search: location.search })',
      );
      if (
        observed.pathname === expected.pathname &&
        (expected.search === undefined || observed.search === expected.search)
      ) {
        return;
      }
      await Bun.sleep(250);
    }
    const bodyText = await this.evaluateAsync<string>('document.body?.innerText ?? ""');
    throw new Error(
      `Timed out waiting for location ${JSON.stringify(expected)}. Observed ${JSON.stringify(observed)}.\nBody:\n${bodyText.slice(-4_000)}\nBrowser errors:\n${this.errors.join('\n').slice(-8_000)}`,
    );
  }

  private evaluateAsync<T>(expression: string): Promise<T> {
    return this.sendAsync('Runtime.evaluate', { expression, returnByValue: true }).then(
      (result) => {
        if (!isRecord(result) || !isRecord(result.result) || !('value' in result.result)) {
          throw new Error(`Chrome evaluation returned no value for: ${expression}`);
        }
        return result.result.value as T;
      },
    );
  }

  private handleMessage(data: unknown): void {
    const message = parseChromeProtocolMessage(data);
    if (!message) return;

    if (message.id !== undefined) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
      else pending.resolve(message.result);
      return;
    }

    const issue = getChromeNavigationIssue(message.method, message.params);
    if (issue) this.errors.push(issue);
  }

  private sendAsync(method: string, params?: Readonly<Record<string, unknown>>): Promise<unknown> {
    const id = this.nextId;
    this.nextId += 1;
    const promise = new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { reject, resolve });
    });
    this.socket.send(JSON.stringify(params ? { id, method, params } : { id, method }));
    return promise;
  }

  private waitForLoadAsync(): Promise<void> {
    return new Promise((resolve) => {
      const timeout = setTimeout(resolve, 10_000);
      const previousMessageHandler = this.socket.onmessage;
      this.socket.onmessage = (event) => {
        this.handleMessage(event.data);
        const message = parseChromeProtocolMessage(event.data);
        if (message?.method !== 'Page.loadEventFired') return;
        clearTimeout(timeout);
        this.socket.onmessage = previousMessageHandler;
        resolve();
      };
    });
  }

  private async waitForBooleanAsync(expression: string, description: string): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < HTTP_TIMEOUT_MS) {
      if (await this.evaluateAsync<boolean>(expression)) return;
      await Bun.sleep(250);
    }
    throw new Error(`Timed out waiting for ${description}.`);
  }

  private waitForSocketAsync(): Promise<void> {
    if (this.socket.readyState === WebSocket.OPEN) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.socket.onopen = () => resolve();
      this.socket.onerror = () => reject(new Error('Chrome DevTools socket failed to open.'));
    });
  }
}

function createRoleAndNameExpression(
  role: string,
  name: string,
  options: { readonly click: boolean; readonly requireHydration: boolean },
): string {
  return `(() => {
  const normalize = (value) => value.replace(/\\s+/gu, ' ').trim();
  const hasHydratedClickHandler = (element) => {
    const propsKey = Object.keys(element).find((key) => key.startsWith('__reactProps$'));
    return propsKey !== undefined && typeof element[propsKey]?.onClick === 'function';
  };
  const element = [...document.querySelectorAll('[role]')].find((candidate) => {
    if (candidate.getAttribute('role') !== ${JSON.stringify(role)}) return false;
    const ariaLabel = candidate.getAttribute('aria-label');
    if (ariaLabel !== null) return normalize(ariaLabel) === ${JSON.stringify(name)};
    const visibleText = normalize(candidate.textContent ?? '');
    return visibleText === ${JSON.stringify(name)} || visibleText.endsWith(${JSON.stringify(name)});
  });
  if (!(element instanceof HTMLElement)) return false;
  ${options.requireHydration ? 'if (!hasHydratedClickHandler(element)) return false;' : ''}
  ${options.click ? 'element.click();' : ''}
  return true;
})()`;
}

async function canAccessAsync(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseChromeProtocolMessage(data: unknown): ChromeProtocolMessage | null {
  const source =
    typeof data === 'string'
      ? data
      : data instanceof ArrayBuffer
        ? Buffer.from(data).toString()
        : '';
  if (!source) return null;
  const parsed = JSON.parse(source) as unknown;
  if (!isRecord(parsed)) return null;
  return {
    ...(typeof parsed.id === 'number' ? { id: parsed.id } : {}),
    ...(typeof parsed.method === 'string' ? { method: parsed.method } : {}),
    ...('params' in parsed ? { params: parsed.params } : {}),
    ...('result' in parsed ? { result: parsed.result } : {}),
    ...('error' in parsed ? { error: parsed.error } : {}),
  };
}

async function resolveChromePathAsync(): Promise<string> {
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
    if (await canAccessAsync(candidate)) return candidate;
  }
  throw new Error('Could not resolve Chrome/Chromium. Set CHROME_PATH before acceptance.');
}

function stopProcess(processToStop: ChildProcess): void {
  if (!processToStop.pid) return;
  try {
    globalThis.process.kill(-processToStop.pid, 'SIGTERM');
  } catch {
    processToStop.kill('SIGTERM');
  }
}

async function waitForHttpAsync(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      await Bun.sleep(250);
    }
  }
  throw new Error(`Timed out waiting for ${url}.`);
}

interface ChromeProtocolMessage {
  readonly error?: unknown;
  readonly id?: number;
  readonly method?: string;
  readonly params?: unknown;
  readonly result?: unknown;
}
