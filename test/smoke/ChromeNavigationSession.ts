import { type ChildProcess, spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathExists } from '@ankhorage/utility/node/fs';
import { stopProcess } from '@ankhorage/utility/node/process';

import { getChromeNavigationIssue } from './getChromeNavigationIssue';

const HTTP_TIMEOUT_MS = 120_000;
const HIT_TEST_TIMEOUT_MS = 10_000;

interface HitTestResult {
  readonly hit?: string;
  readonly state: 'blocked' | 'missing' | 'ready' | 'scrolling';
  readonly x?: number;
  readonly y?: number;
}

interface PointerTarget {
  readonly x: number;
  readonly y: number;
}

const APPLICATION_INTERACTIVE_TEST_ID = 'ankh-app-interactive';

/***
 * Drive a headless Chrome DevTools Protocol session for Studio web acceptance, including navigation, hydration, hit testing, font assertions and browser-error capture.
 */
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

  /***
   * Launch a detached headless Chrome process, open a CDP page target and initialize the protocol domains used by acceptance checks.
   */
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
      await session.sendAsync('Network.enable');
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

  /*** Bind the launched Chrome process and CDP socket and route incoming protocol messages to the session dispatcher. */
  private constructor(process: ChildProcess, socket: WebSocket) {
    this.process = process;
    this.socket = socket;
    this.socket.onmessage = (event) => this.handleMessage(event.data);
  }

  /*** Clear browser local storage in the active acceptance page. */
  async clearLocalStorageAsync(): Promise<void> {
    await this.evaluateAsync('(() => { localStorage.clear(); return true; })()');
  }

  /*** Hit-test and dispatch a real pointer click to the requested accessible role/name occurrence. */
  async clickByRoleAndNameAsync(role: string, name: string, occurrence = 0): Promise<void> {
    await this.waitForApplicationInteractiveAsync();
    const point = await this.waitForHitTestedRoleAndNameAsync(role, name, occurrence);
    await this.dispatchPointerClickAsync(point);
  }

  /*** Hit-test and dispatch a real pointer click to the requested visible test-id control. */
  async clickByTestIdAsync(testId: string): Promise<void> {
    await this.waitForApplicationInteractiveAsync();
    const point = await this.waitForHitTestedTestIdAsync(testId);
    await this.dispatchPointerClickAsync(point);
  }

  /*** Dispatch a browser-native primary-pointer click at an already hit-tested viewport coordinate. */
  private async dispatchPointerClickAsync(point: PointerTarget): Promise<void> {
    await this.sendAsync('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: point.x,
      y: point.y,
    });
    await this.sendAsync('Input.dispatchMouseEvent', {
      button: 'left',
      buttons: 1,
      clickCount: 1,
      type: 'mousePressed',
      x: point.x,
      y: point.y,
    });
    await this.sendAsync('Input.dispatchMouseEvent', {
      button: 'left',
      buttons: 0,
      clickCount: 1,
      type: 'mouseReleased',
      x: point.x,
      y: point.y,
    });
  }

  /*** Close the CDP socket and terminate the detached Chrome process group. */
  close(): void {
    this.socket.close();
    stopProcess(this.process);
  }

  /*** Navigate backward through browser history in the active page. */
  async goBackAsync(): Promise<void> {
    await this.evaluateAsync('(() => { history.back(); return true; })()');
  }

  /*** Navigate forward through browser history in the active page. */
  async goForwardAsync(): Promise<void> {
    await this.evaluateAsync('(() => { history.forward(); return true; })()');
  }

  /*** Install a page bootstrap that offsets Date.now by a local-storage value for deterministic time-based acceptance scenarios. */
  async installDateNowOffsetAsync(storageKey: string): Promise<void> {
    await this.sendAsync('Page.addScriptToEvaluateOnNewDocument', {
      source: `(() => {
  const originalDateNow = Date.now.bind(Date);
  Date.now = () => {
    try {
      const offset = Number.parseInt(localStorage.getItem(${JSON.stringify(storageKey)}) ?? '0', 10);
      return originalDateNow() + (Number.isFinite(offset) ? offset : 0);
    } catch {
      return originalDateNow();
    }
  };
})();`,
    });
  }

  /*** Install a document observer that records distinct rendered body-text snapshots for transient-state assertions. */
  async installObservedBodyTextHistoryAsync(): Promise<void> {
    await this.sendAsync('Page.addScriptToEvaluateOnNewDocument', {
      source: `(() => {
  const observedBodyText = [];
  Object.defineProperty(globalThis, '__ankhObservedBodyText', {
    configurable: false,
    value: observedBodyText,
  });
  const recordBodyText = () => {
    const bodyText = document.body?.innerText ?? '';
    if (bodyText.length > 0 && observedBodyText.at(-1) !== bodyText) observedBodyText.push(bodyText);
  };
  new MutationObserver(recordBodyText).observe(document, {
    childList: true,
    characterData: true,
    subtree: true,
  });
  document.addEventListener('DOMContentLoaded', recordBodyText, { once: true });
})();`,
    });
  }

  /*** Install a page bootstrap that continuously records distinct pathname values for transient navigation assertions. */
  async installObservedPathnameHistoryAsync(): Promise<void> {
    await this.sendAsync('Page.addScriptToEvaluateOnNewDocument', {
      source: `(() => {
  const observedPathnames = [];
  Object.defineProperty(globalThis, '__ankhObservedPathnames', {
    configurable: false,
    value: observedPathnames,
  });
  const recordPathname = () => {
    const pathname = globalThis.location?.pathname;
    if (typeof pathname === 'string' && observedPathnames.at(-1) !== pathname) {
      observedPathnames.push(pathname);
    }
  };
  recordPathname();
  setInterval(recordPathname, 5);
})();`,
    });
  }

  /*** Check whether a visible element with the requested accessible role and name currently exists. */
  async hasRoleAndNameAsync(role: string, name: string): Promise<boolean> {
    return this.evaluateAsync<boolean>(createRoleAndNameExpression(role, name, 0));
  }

  /*** Capture the active route, rendered body, matching test-id DOM and browser errors for a browser-transition diagnosis. */
  async capturePageDiagnosticsAsync(testIds: readonly string[]): Promise<{
    readonly bodyText: string;
    readonly errors: readonly string[];
    readonly pathname: string;
    readonly testIds: readonly {
      readonly html: string;
      readonly id: string;
      readonly visible: boolean;
    }[];
  }> {
    const page = await this.evaluateAsync<{
      readonly bodyText: string;
      readonly pathname: string;
      readonly testIds: readonly {
        readonly html: string;
        readonly id: string;
        readonly visible: boolean;
      }[];
    }>(`(() => {
  const requested = new Set(${JSON.stringify(testIds)});
  const testIds = [...document.querySelectorAll('[data-testid]')]
    .filter((element) => requested.has(element.getAttribute('data-testid') ?? ''))
    .map((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        html: element.outerHTML.slice(0, 2_000),
        id: element.getAttribute('data-testid') ?? '',
        visible: rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden',
      };
    });
  return { bodyText: (document.body?.innerText ?? '').slice(-4_000), pathname: location.pathname, testIds };
})()`);
    return { ...page, errors: [...this.errors] };
  }

  /*** Check whether any previously recorded body-text snapshot contains the requested text. */
  async hasObservedBodyTextAsync(expectedText: string): Promise<boolean> {
    return this.evaluateAsync<boolean>(`(() => {
  const history = Reflect.get(globalThis, '__ankhObservedBodyText');
  return Array.isArray(history) && history.some(
    (bodyText) => typeof bodyText === 'string' && bodyText.includes(${JSON.stringify(expectedText)}),
  );
})()`);
  }

  /*** Check whether the pathname observer has recorded the requested route. */
  async hasObservedPathnameAsync(expectedPathname: string): Promise<boolean> {
    return this.evaluateAsync<boolean>(`(() => {
  const history = Reflect.get(globalThis, '__ankhObservedPathnames');
  return Array.isArray(history) && history.includes(${JSON.stringify(expectedPathname)});
})()`);
  }

  /*** Read the browser pathname transitions recorded by the installed navigation observer. */
  async readObservedPathnamesAsync(): Promise<readonly string[]> {
    return this.evaluateAsync<readonly string[]>(`(() => {
  const history = Reflect.get(globalThis, '__ankhObservedPathnames');
  return Array.isArray(history) ? history.filter((pathname) => typeof pathname === 'string') : [];
})()`);
  }

  /*** Assert that the requested accessible element renders a loaded glyph with the expected font family. */
  async assertRoleUsesFontFamilyAsync(
    role: string,
    name: string,
    fontFamily: string,
    occurrence = 0,
  ): Promise<void> {
    const result = await this.evaluateAsync<{
      readonly computedFamily?: string;
      readonly faceLoaded: boolean;
      readonly glyphLoaded: boolean;
    }>(createRoleFontExpression(role, name, fontFamily, occurrence));
    if (result.faceLoaded && result.glyphLoaded && result.computedFamily === fontFamily) return;
    throw new Error(
      `${role} named "${name}" does not render with loaded ${fontFamily}: ${JSON.stringify(result)}.`,
    );
  }

  /*** Navigate the active Chrome target to a URL and wait for the page load event. */
  async navigateAsync(url: string): Promise<void> {
    await this.sendAsync('Page.navigate', { url });
    await this.waitForLoadAsync();
  }

  /*** Reload the active Chrome target and wait for its page load event. */
  async reloadAsync(): Promise<void> {
    await this.sendAsync('Page.reload');
    await this.waitForLoadAsync();
  }

  /*** Assert that the document's scroll width does not exceed its client viewport width. */
  async assertNoHorizontalOverflowAsync(label: string): Promise<void> {
    const layout = await this.evaluateAsync<{
      readonly clientWidth: number;
      readonly scrollWidth: number;
    }>(
      '({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth })',
    );
    if (layout.scrollWidth > layout.clientWidth) {
      throw new Error(
        `${label} overflows horizontally: ${layout.scrollWidth}px content in a ${layout.clientWidth}px viewport.`,
      );
    }
  }

  /*** Override Chrome device metrics for one desktop or mobile acceptance viewport. */
  async setViewportAsync(width: number, height: number): Promise<void> {
    await this.sendAsync('Emulation.setDeviceMetricsOverride', {
      deviceScaleFactor: 1,
      height,
      mobile: width < 768,
      width,
    });
  }

  /*** Set one local-storage entry in the active page. */
  async setLocalStorageItemAsync(key: string, value: string): Promise<void> {
    await this.evaluateAsync(
      `(() => { localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(value)}); return true; })()`,
    );
  }

  /*** Poll the browser FontFaceSet until every requested font family is loaded or the acceptance timeout expires. */
  async waitForLoadedFontFamiliesAsync(
    fontFamilies: readonly string[],
    timeoutMs = HTTP_TIMEOUT_MS,
  ): Promise<void> {
    const expression = `(() => {
  const normalize = (value) => value.replaceAll('"', '').trim();
  const required = ${JSON.stringify(fontFamilies)};
  for (const family of required) {
    void document.fonts.load('16px "' + family + '"');
  }
  const faces = [...document.fonts].map((face) => ({
    family: normalize(face.family),
    status: face.status,
  }));
  return {
    faces,
    ready: required.every((family) =>
      faces.some((face) => face.family === family && face.status === 'loaded'),
    ),
    style: document.getElementById('expo-generated-fonts')?.textContent ?? '',
  };
})()`;
    let observed: {
      readonly faces: readonly { readonly family: string; readonly status: string }[];
      readonly ready: boolean;
      readonly style: string;
    } = { faces: [], ready: false, style: '' };
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      observed = await this.evaluateAsync<typeof observed>(expression);
      if (observed.ready) return;
      await Bun.sleep(250);
    }
    throw new Error(
      `Timed out waiting for loaded font families ${fontFamilies.join(', ')}. Observed: ${JSON.stringify(observed)}.`,
    );
  }

  /*** Wait until the requested accessible role/name control has a visible, unobstructed browser interaction surface. */
  async waitForInteractiveRoleAndNameAsync(
    role: string,
    name: string,
    occurrence = 0,
  ): Promise<void> {
    await this.waitForHitTestedRoleAndNameAsync(role, name, occurrence);
  }

  /*** Wait until the generated application has committed its post-hydration interactive boundary. */
  async waitForApplicationInteractiveAsync(): Promise<void> {
    await this.waitForVisibleTestIdAsync(APPLICATION_INTERACTIVE_TEST_ID);
  }

  /*** Wait until the requested test-id control is visible in the active browser viewport. */
  async waitForVisibleTestIdAsync(testId: string): Promise<void> {
    const expression = `(() => {
  return [...document.querySelectorAll('[data-testid]')].some((candidate) => {
    if (candidate.getAttribute('data-testid') !== ${JSON.stringify(testId)}) return false;
    if (!(candidate instanceof HTMLElement)) return false;
    const rect = candidate.getBoundingClientRect();
    const style = getComputedStyle(candidate);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  });
})()`;
    await this.waitForBooleanAsync(expression, `visible testID "${testId}"`);
  }

  /*** Poll rendered body text until it contains the requested content and return the matching snapshot. */
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

  /*** Wait until a previously observed body-text snapshot contains the requested content. */
  async waitForObservedBodyTextAsync(
    expectedText: string,
    timeoutMs = HTTP_TIMEOUT_MS,
  ): Promise<void> {
    const expression = `(() => {
  const history = Reflect.get(globalThis, '__ankhObservedBodyText');
  return Array.isArray(history) && history.some(
    (bodyText) => typeof bodyText === 'string' && bodyText.includes(${JSON.stringify(expectedText)}),
  );
})()`;
    await this.waitForBooleanAsync(expression, `observed body text "${expectedText}"`, timeoutMs);
  }

  /*** Poll the browser location until pathname and optional search string match, reporting page and browser diagnostics on timeout. */
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
    const observedPathnames = await this.readObservedPathnamesAsync();
    throw new Error(
      `Timed out waiting for location ${JSON.stringify(expected)}. Observed ${JSON.stringify(observed)}.\nNavigation trace:\n${observedPathnames.join(' -> ')}\nBody:\n${bodyText.slice(-4_000)}\nBrowser errors:\n${this.errors.join('\n').slice(-8_000)}`,
    );
  }

  /*** Evaluate a JavaScript expression through CDP and unwrap its by-value result. */
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

  /*** Dispatch one incoming CDP response or event to its pending request or browser-issue collector. */
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

  /*** Send one CDP request with a monotonically increasing id and resolve it when the matching response arrives. */
  private sendAsync(method: string, params?: Readonly<Record<string, unknown>>): Promise<unknown> {
    const id = this.nextId;
    this.nextId += 1;
    const promise = new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { reject, resolve });
    });
    this.socket.send(JSON.stringify(params ? { id, method, params } : { id, method }));
    return promise;
  }

  /*** Wait for Chrome's next page-load event, with a bounded fallback timeout so acceptance cannot hang indefinitely. */
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

  /*** Poll a browser expression until it evaluates truthy or the configured timeout expires. */
  private async waitForBooleanAsync(
    expression: string,
    description: string,
    timeoutMs = HTTP_TIMEOUT_MS,
  ): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await this.evaluateAsync<boolean>(expression)) return;
      await Bun.sleep(250);
    }
    throw new Error(`Timed out waiting for ${description}.`);
  }

  /*** Poll real DOM hit testing for an accessible element until its center point is visible and unobstructed. */
  private async waitForHitTestedRoleAndNameAsync(
    role: string,
    name: string,
    occurrence: number,
  ): Promise<PointerTarget> {
    const expression = createRoleHitTestExpression(role, name, occurrence);
    const start = Date.now();
    let observed: HitTestResult = { state: 'missing' };
    while (Date.now() - start < HIT_TEST_TIMEOUT_MS) {
      observed = await this.evaluateAsync<HitTestResult>(expression);
      if (observed.state === 'ready' && observed.x !== undefined && observed.y !== undefined) {
        return { x: observed.x, y: observed.y };
      }
      await Bun.sleep(100);
    }
    throw new Error(
      `Hit testing blocked ${role} named "${name}" at occurrence ${occurrence}: ${JSON.stringify(observed)}.`,
    );
  }

  /*** Poll real DOM hit testing for a test-id control until its interaction surface is visible and unobstructed. */
  private async waitForHitTestedTestIdAsync(testId: string): Promise<PointerTarget> {
    const expression = createTestIdHitTestExpression(testId);
    const start = Date.now();
    let observed: HitTestResult = { state: 'missing' };
    while (Date.now() - start < HIT_TEST_TIMEOUT_MS) {
      observed = await this.evaluateAsync<HitTestResult>(expression);
      if (observed.state === 'ready' && observed.x !== undefined && observed.y !== undefined) {
        return { x: observed.x, y: observed.y };
      }
      await Bun.sleep(100);
    }
    throw new Error(`Hit testing blocked testID "${testId}": ${JSON.stringify(observed)}.`);
  }

  /*** Wait for the Chrome DevTools WebSocket to open or reject when the connection fails. */
  private waitForSocketAsync(): Promise<void> {
    if (this.socket.readyState === WebSocket.OPEN) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.socket.onopen = () => resolve();
      this.socket.onerror = () => reject(new Error('Chrome DevTools socket failed to open.'));
    });
  }
}

/*** Build a browser expression that finds a visible element by accessible role/name and optionally requires a hydrated React click handler. */
function createRoleAndNameExpression(role: string, name: string, occurrence: number): string {
  return `(() => {
  const normalize = (value) => value.replace(/\\s+/gu, ' ').trim();
  const elements = [...document.querySelectorAll('[role]')].filter((candidate) => {
    if (candidate.getAttribute('role') !== ${JSON.stringify(role)}) return false;
    const ariaLabel = candidate.getAttribute('aria-label');
    const visibleText = normalize(candidate.textContent ?? '');
    const matchesName = ariaLabel !== null
      ? normalize(ariaLabel) === ${JSON.stringify(name)}
      : visibleText === ${JSON.stringify(name)} || visibleText.endsWith(${JSON.stringify(name)});
    if (!matchesName || !(candidate instanceof HTMLElement)) return false;
    const rect = candidate.getBoundingClientRect();
    const style = getComputedStyle(candidate);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  });
  const element = elements[${occurrence}];
  if (!(element instanceof HTMLElement)) return false;
  return true;
})()`;
}

/*** Build a browser expression that inspects a role/name match for a loaded glyph rendered by the requested font family. */
function createRoleFontExpression(
  role: string,
  name: string,
  fontFamily: string,
  occurrence: number,
): string {
  return `(() => {
  const normalize = (value) => value.replace(/\\s+/gu, ' ').trim();
  const elements = [...document.querySelectorAll('[role]')].filter((candidate) => {
    if (candidate.getAttribute('role') !== ${JSON.stringify(role)}) return false;
    const ariaLabel = candidate.getAttribute('aria-label');
    const visibleText = normalize(candidate.textContent ?? '');
    const matchesName = ariaLabel !== null
      ? normalize(ariaLabel) === ${JSON.stringify(name)}
      : visibleText === ${JSON.stringify(name)} || visibleText.endsWith(${JSON.stringify(name)});
    if (!matchesName || !(candidate instanceof HTMLElement)) return false;
    const rect = candidate.getBoundingClientRect();
    const style = getComputedStyle(candidate);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  });
  const element = elements[${occurrence}];
  if (!(element instanceof HTMLElement)) {
    return { faceLoaded: false, glyphLoaded: false };
  }
  const expectedFamily = ${JSON.stringify(fontFamily)};
  const normalizeFamily = (value) => value.replaceAll('"', '').trim();
  const icon = [element, ...element.querySelectorAll('*')].find((candidate) =>
    getComputedStyle(candidate).fontFamily
      .split(',')
      .map(normalizeFamily)
      .includes(expectedFamily),
  );
  if (!(icon instanceof HTMLElement)) {
    return { faceLoaded: false, glyphLoaded: false };
  }
  const computedStyle = getComputedStyle(icon);
  const glyph = icon.textContent ?? '';
  const faceLoaded = [...document.fonts].some(
    (face) => normalizeFamily(face.family) === expectedFamily && face.status === 'loaded',
  );
  return {
    computedFamily: normalizeFamily(computedStyle.fontFamily.split(',')[0] ?? ''),
    faceLoaded,
    glyphLoaded:
      glyph.length > 0 &&
      document.fonts.check(computedStyle.fontSize + ' "' + expectedFamily + '"', glyph),
  };
})()`;
}

/*** Build a browser expression that scrolls to and hit-tests the center point of a visible role/name match. */
function createRoleHitTestExpression(role: string, name: string, occurrence: number): string {
  return `(() => {
  const normalize = (value) => value.replace(/\\s+/gu, ' ').trim();
  const elements = [...document.querySelectorAll('[role]')].filter((candidate) => {
    if (candidate.getAttribute('role') !== ${JSON.stringify(role)}) return false;
    const ariaLabel = candidate.getAttribute('aria-label');
    const visibleText = normalize(candidate.textContent ?? '');
    const matchesName = ariaLabel !== null
      ? normalize(ariaLabel) === ${JSON.stringify(name)}
      : visibleText === ${JSON.stringify(name)} || visibleText.endsWith(${JSON.stringify(name)});
    if (!matchesName || !(candidate instanceof HTMLElement)) return false;
    const rect = candidate.getBoundingClientRect();
    const style = getComputedStyle(candidate);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  });
  const element = elements[${occurrence}];
  if (!(element instanceof HTMLElement)) {
    const buttons = [...document.querySelectorAll('[role="button"]')].map((candidate) => ({
      label: candidate.getAttribute('aria-label'),
      text: normalize(candidate.textContent ?? ''),
    }));
    return {
      hit: JSON.stringify({ buttons, pathname: location.pathname }),
      state: 'missing',
    };
  }
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return { state: 'missing' };
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) {
    element.scrollIntoView({ block: 'center', inline: 'center' });
    return { state: 'scrolling' };
  }
  const hit = document.elementFromPoint(x, y);
  if (!(hit instanceof Element) || !element.contains(hit)) {
    const hitRole = hit instanceof Element ? hit.getAttribute('role') : null;
    const hitLabel = hit instanceof Element ? hit.getAttribute('aria-label') : null;
    return {
      state: 'blocked',
      hit: hit instanceof Element
        ? [
            hit.tagName.toLowerCase(),
            hitRole ? 'role=' + hitRole : '',
            hitLabel ? 'aria-label=' + hitLabel : '',
          ].filter(Boolean).join(' ')
        : 'none',
    };
  }
  return { state: 'ready', x, y };
})()`;
}

/*** Build a browser expression that scrolls to and hit-tests the interaction surface associated with a visible test id. */
function createTestIdHitTestExpression(testId: string): string {
  return `(() => {
  const element = [...document.querySelectorAll('[data-testid]')].find((candidate) => {
    if (candidate.getAttribute('data-testid') !== ${JSON.stringify(testId)}) return false;
    if (!(candidate instanceof HTMLElement)) return false;
    const rect = candidate.getBoundingClientRect();
    const style = getComputedStyle(candidate);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  });
  if (!(element instanceof HTMLElement)) return { state: 'missing' };
  const control = element.closest('[role="button"], [role="tab"]') ?? element;
  if (!(control instanceof HTMLElement)) return { state: 'missing' };
  const rect = control.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) {
    control.scrollIntoView({ block: 'center', inline: 'center' });
    return { state: 'scrolling' };
  }
  const hit = document.elementFromPoint(x, y);
  if (!(hit instanceof Element) || !control.contains(hit)) {
    const hitRole = hit instanceof Element ? hit.getAttribute('role') : null;
    const hitLabel = hit instanceof Element ? hit.getAttribute('aria-label') : null;
    return {
      state: 'blocked',
      hit: hit instanceof Element
        ? [
            hit.tagName.toLowerCase(),
            hitRole ? 'role=' + hitRole : '',
            hitLabel ? 'aria-label=' + hitLabel : '',
          ].filter(Boolean).join(' ')
        : 'none',
    };
  }
  return { state: 'ready', x, y };
})()`;
}

/***
 * Narrow an unknown value to a non-null object record.
 * Utility candidate: @ankhorage/utility/object
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/*** Parse a string or ArrayBuffer CDP payload into the protocol fields consumed by the Chrome acceptance session. */
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

/*** Resolve the Chrome/Chromium executable from CHROME_PATH or the supported Linux/macOS installation locations. */
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
    if (await pathExists(candidate)) return candidate;
  }
  throw new Error('Could not resolve Chrome/Chromium. Set CHROME_PATH before acceptance.');
}

/***
 * Poll an HTTP endpoint until it responds below the 5xx range or the timeout expires.
 * Utility candidate: @ankhorage/utility/http
 */
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
