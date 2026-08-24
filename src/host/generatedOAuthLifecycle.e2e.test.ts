import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it } from 'bun:test';

import { getAuthOAuthRuntimeTs } from './layout/templates/auth/oauth';

const SESSION_STORAGE_KEY = 'generated.oauth.session';
const TRANSPORT_ATTEMPT_KEY = 'ankh.auth.oauth.transport';
const CALLBACK_URL = 'https://app.example/auth/callback';
const SCENARIO_ENV = 'ANKH_GENERATED_OAUTH_SCENARIO';
const temporaryRoots = new Set<string>();
const hadOriginalLocation = Reflect.has(globalThis, 'location');
const originalLocation: unknown = Reflect.get(globalThis, 'location');

type IsolatedScenario = 'denial' | 'expired' | 'malformed' | 'mismatched' | 'missing' | 'success';

interface GeneratedOAuthRuntime {
  startOAuthAuthorization(providerId: string): Promise<GeneratedOAuthOutcome>;
  completeOAuthCallback(callbackUrl: string): Promise<GeneratedOAuthOutcome>;
}

type GeneratedOAuthOutcome =
  | { status: 'authenticated' }
  | { status: 'cancelled'; message: string }
  | { status: 'error'; message: string; recoverable: boolean };

interface HarnessState {
  readonly assignedUrls: string[];
  readonly fetchCalls: { readonly body?: string; readonly url: string }[];
  readonly values: Map<string, string>;
}

interface GeneratedOAuthHarness {
  readonly state: HarnessState;
  importDocument(label: string): Promise<GeneratedOAuthRuntime>;
}

afterEach(async () => {
  await Promise.all(
    [...temporaryRoots].map(async (root) => {
      await rm(root, { force: true, recursive: true });
      temporaryRoots.delete(root);
    }),
  );
  if (!hadOriginalLocation) {
    Reflect.deleteProperty(globalThis, 'location');
  } else {
    Reflect.set(globalThis, 'location', originalLocation);
  }
});

const isolatedScenarioValue: unknown = Reflect.get(process.env, SCENARIO_ENV);
const isolatedScenario =
  isolatedScenarioValue === 'success' ||
  isolatedScenarioValue === 'denial' ||
  isolatedScenarioValue === 'expired' ||
  isolatedScenarioValue === 'malformed' ||
  isolatedScenarioValue === 'mismatched' ||
  isolatedScenarioValue === 'missing'
    ? isolatedScenarioValue
    : undefined;
if (isolatedScenario !== undefined) {
  describe('isolated generated OAuth lifecycle scenario', () => {
    it(isolatedScenario, async () => {
      await runScenario(isolatedScenario);
    });
  });
} else {
  describe('generated OAuth lifecycle across full-page navigation', () => {
    it('preserves PKCE state, exchanges once, persists one session, and tolerates callback reload', async () => {
      await runIsolatedScenario('success');
    });

    it('cleans provider denial across navigation and permits an immediate new attempt', async () => {
      await runIsolatedScenario('denial');
    });

    it.each(['missing', 'malformed', 'mismatched', 'expired'] as const)(
      'rejects %s callback state without exchanging or creating a session',
      async (scenario) => {
        await runIsolatedScenario(scenario);
      },
    );
  });
}

async function runScenario(scenario: IsolatedScenario): Promise<void> {
  switch (scenario) {
    case 'denial':
      return runProviderDenialScenario();
    case 'expired':
    case 'malformed':
    case 'mismatched':
    case 'missing':
      return runRejectedCallbackScenario(scenario);
    case 'success':
      return runSuccessfulCallbackScenario();
  }
}

async function runIsolatedScenario(scenario: IsolatedScenario): Promise<void> {
  const child = Bun.spawn({
    cmd: [process.execPath, 'test', fileURLToPath(import.meta.url)],
    cwd: process.cwd(),
    env: { ...process.env, [SCENARIO_ENV]: scenario },
    stderr: 'pipe',
    stdout: 'pipe',
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (exitCode !== 0) {
    throw new Error(
      `Generated OAuth ${scenario} scenario failed with exit code ${exitCode}.\n${stdout}\n${stderr}`,
    );
  }
}

async function runSuccessfulCallbackScenario(): Promise<void> {
  const harness = await createHarness();
  const startDocument = await harness.importDocument('start');

  void startDocument.startOAuthAuthorization('google');
  await waitFor(() => harness.state.assignedUrls.length === 1);

  const markerBeforeCallback = readTransportMarker(harness.state.values);
  expect(markerBeforeCallback.attemptId.length).toBeGreaterThan(0);
  expect(JSON.stringify(markerBeforeCallback)).not.toContain('provider');
  expect(JSON.stringify(markerBeforeCallback)).not.toContain('redirectUri');
  expect(hasPkceVerifier(harness.state.values)).toBe(true);

  const callbackDocument = await harness.importDocument('callback');
  const completed = await callbackDocument.completeOAuthCallback(
    `${CALLBACK_URL}?code=opaque-code`,
  );

  expect(completed).toEqual({ status: 'authenticated' });
  expect(harness.state.fetchCalls).toHaveLength(1);
  expect(harness.state.fetchCalls[0]?.url).toContain('/auth/v1/token?grant_type=pkce');
  expect(harness.state.values.has(SESSION_STORAGE_KEY)).toBe(true);
  expect(harness.state.values.has(TRANSPORT_ATTEMPT_KEY)).toBe(true);
  expect(hasPkceVerifier(harness.state.values)).toBe(false);
  expect([...harness.state.values.values()].join('\n')).not.toContain('opaque-code');

  for (const [label, callbackUrl] of [
    ['missing-code', CALLBACK_URL],
    ['stale-code', `${CALLBACK_URL}?code=stale-code`],
    ['invalid-parameters', `${CALLBACK_URL}?code=opaque-code&error_description=invalid`],
  ] as const) {
    const invalidCallbackDocument = await harness.importDocument(label);
    const rejected = await invalidCallbackDocument.completeOAuthCallback(callbackUrl);

    expect(rejected).toEqual({
      status: 'error',
      message: 'The OAuth callback does not match the completed authorization callback.',
      recoverable: true,
    });
    expect(harness.state.fetchCalls).toHaveLength(1);
    expect(harness.state.values.has(TRANSPORT_ATTEMPT_KEY)).toBe(true);
  }

  const reloadedCallbackDocument = await harness.importDocument('callback-reload');
  const replay = await reloadedCallbackDocument.completeOAuthCallback(
    `${CALLBACK_URL}?code=opaque-code`,
  );

  expect(replay).toEqual({ status: 'authenticated' });
  expect(harness.state.fetchCalls).toHaveLength(1);
}

async function runProviderDenialScenario(): Promise<void> {
  const harness = await createHarness();
  const startDocument = await harness.importDocument('denial-start');

  void startDocument.startOAuthAuthorization('google');
  await waitFor(() => harness.state.assignedUrls.length === 1);
  const firstAttemptId = readTransportMarker(harness.state.values).attemptId;
  expect(hasPkceVerifier(harness.state.values)).toBe(true);

  const callbackDocument = await harness.importDocument('denial-callback');
  const denied = await callbackDocument.completeOAuthCallback(
    `${CALLBACK_URL}?error=access_denied`,
  );

  expect(denied).toEqual({
    status: 'cancelled',
    message: 'Authorization was declined by the provider.',
  });
  expect(harness.state.fetchCalls).toHaveLength(0);
  expect(harness.state.values.has(TRANSPORT_ATTEMPT_KEY)).toBe(false);
  expect(hasPkceVerifier(harness.state.values)).toBe(false);

  const restartDocument = await harness.importDocument('denial-restart');
  void restartDocument.startOAuthAuthorization('google');
  await waitFor(() => harness.state.assignedUrls.length === 2);

  const restartedAttemptId = readTransportMarker(harness.state.values).attemptId;
  expect(restartedAttemptId).not.toBe(firstAttemptId);
  expect(hasPkceVerifier(harness.state.values)).toBe(true);
}

async function runRejectedCallbackScenario(
  scenario: 'expired' | 'malformed' | 'mismatched' | 'missing',
): Promise<void> {
  const harness = await createHarness();
  let callbackUrl = `${CALLBACK_URL}?code=opaque-code`;

  if (scenario !== 'missing') {
    const startDocument = await harness.importDocument(`${scenario}-start`);
    void startDocument.startOAuthAuthorization('google');
    await waitFor(() => harness.state.assignedUrls.length === 1);
  }

  if (scenario === 'malformed') {
    callbackUrl = 'not-a-callback-url';
  } else if (scenario === 'mismatched') {
    harness.state.values.set(
      TRANSPORT_ATTEMPT_KEY,
      JSON.stringify({ attemptId: crypto.randomUUID() }),
    );
  } else if (scenario === 'expired') {
    expireOwnerAttempt(harness.state.values);
  }

  const callbackDocument = await harness.importDocument(`${scenario}-callback`);
  const rejected = await callbackDocument.completeOAuthCallback(callbackUrl);

  expect(rejected).toEqual({
    status: 'error',
    message: expectedRejectedCallbackMessage(scenario),
    recoverable: true,
  });
  expect(harness.state.fetchCalls).toHaveLength(0);
  expect(harness.state.values.has(SESSION_STORAGE_KEY)).toBe(false);
  expect(harness.state.values.has(TRANSPORT_ATTEMPT_KEY)).toBe(false);
}

async function createHarness(): Promise<GeneratedOAuthHarness> {
  const root = await mkdtemp(path.join(tmpdir(), 'ankh-generated-oauth-lifecycle-'));
  temporaryRoots.add(root);
  await symlink(path.join(process.cwd(), 'node_modules'), path.join(root, 'node_modules'), 'dir');

  await writeFile(
    path.join(root, 'state.ts'),
    `export const values = new Map<string, string>();\n` +
      `export const assignedUrls: string[] = [];\n` +
      `export const fetchCalls: { body?: string; url: string }[] = [];\n`,
  );

  const state = (await import(moduleUrl(path.join(root, 'state.ts'), 'state'))) as HarnessState;
  Reflect.set(globalThis, 'location', {
    origin: 'https://app.example',
    assign: (url: string) => {
      state.assignedUrls.push(url);
    },
  });

  return {
    state,
    async importDocument(label: string) {
      const documentRoot = path.join(root, label);
      await writeDocument(documentRoot);
      return (await import(
        moduleUrl(path.join(documentRoot, 'oauth.ts'), label)
      )) as GeneratedOAuthRuntime;
    },
  };
}

async function writeDocument(documentRoot: string): Promise<void> {
  await mkdir(documentRoot, { recursive: true });
  await Promise.all([
    writeFile(path.join(documentRoot, 'oauth.ts'), createGeneratedOAuthSource()),
    writeFile(
      path.join(documentRoot, 'runtimeReadiness.ts'),
      `export function resolveExpoOAuthBrowserRuntimeReadiness(): never {\n` +
        `  throw new Error('Native OAuth runtime preflight must not run on Web.');\n` +
        `}\n`,
    ),
    writeFile(
      path.join(documentRoot, 'session.ts'),
      `import { values } from '../state.ts';\n\n` +
        `export const AUTH_SESSION_STORAGE_KEY = '${SESSION_STORAGE_KEY}';\n` +
        `export const authSessionStorage = {\n` +
        `  getItem: (key: string) => values.get(key) ?? null,\n` +
        `  setItem: (key: string, value: string) => { values.set(key, value); },\n` +
        `  removeItem: (key: string) => { values.delete(key); },\n` +
        `};\n\n` +
        `export function getStoredAuthSession() {\n` +
        `  return values.has(AUTH_SESSION_STORAGE_KEY) ? { user: { id: 'user-1' } } : null;\n` +
        `}\n`,
    ),
    writeFile(
      path.join(documentRoot, 'adapter.ts'),
      `import { createSupabaseAuthAdapter } from '@ankhorage/supabase-auth';\n` +
        `import { fetchCalls } from '../state.ts';\n` +
        `import { AUTH_SESSION_STORAGE_KEY, authSessionStorage } from './session.ts';\n\n` +
        `export const authAdapter = createSupabaseAuthAdapter({\n` +
        `  url: 'https://example.supabase.co',\n` +
        `  anonKey: 'anon',\n` +
        `  storage: authSessionStorage,\n` +
        `  storageKey: AUTH_SESSION_STORAGE_KEY,\n` +
        `  oauthProviders: ['google'],\n` +
        `  fetch: (input, init) => {\n` +
        `    const url = input instanceof Request ? input.url : input.toString();\n` +
        `    fetchCalls.push({ url, ...(typeof init?.body === 'string' ? { body: init.body } : {}) });\n` +
        `    if (!url.includes('/auth/v1/token?grant_type=pkce')) {\n` +
        `      return Promise.reject(new Error('Unexpected OAuth request.'));\n` +
        `    }\n` +
        `    return Promise.resolve(new Response(JSON.stringify({\n` +
        `      access_token: 'access-token',\n` +
        `      refresh_token: 'refresh-token',\n` +
        `      expires_in: 3600,\n` +
        `      token_type: 'bearer',\n` +
        `      user: {\n` +
        `        id: 'user-1',\n` +
        `        email: 'person@example.com',\n` +
        `        app_metadata: {},\n` +
        `        user_metadata: {},\n` +
        `        aud: 'authenticated',\n` +
        `      },\n` +
        `    }), { status: 200, headers: { 'content-type': 'application/json' } }));\n` +
        `  },\n` +
        `});\n`,
    ),
    writeFile(
      path.join(documentRoot, 'linking.ts'),
      `export const createURL = (path: string) => \`ankh-app://\${path}\`;\n`,
    ),
    writeFile(
      path.join(documentRoot, 'webBrowser.ts'),
      `export type WebBrowserAuthSessionResult =\n` +
        `  | { type: 'success'; url: string }\n` +
        `  | { type: 'dismiss' | 'cancel' };\n` +
        `export function openAuthSessionAsync(): Promise<WebBrowserAuthSessionResult> {\n` +
        `  return Promise.resolve({ type: 'dismiss' });\n` +
        `}\n`,
    ),
    writeFile(path.join(documentRoot, 'platform.ts'), `export const Platform = { OS: 'web' };\n`),
  ]);
}

function createGeneratedOAuthSource(): string {
  return getAuthOAuthRuntimeTs({
    callbackRoute: '/auth/callback',
    callbackRouteName: 'auth/callback',
    callbackTopLevelRouteName: 'auth',
    nativeSchemes: {},
    providers: [
      {
        id: 'google',
        label: 'Google',
        scopes: ['openid', 'email', 'profile'],
        queryParams: {},
      },
    ],
  })
    .replace(
      "from '@ankhorage/expo-runtime/oauth-browser-runtime';",
      "from './runtimeReadiness.ts';",
    )
    .replace("from 'expo-linking';", "from './linking.ts';")
    .replace("from 'expo-web-browser';", "from './webBrowser.ts';")
    .replace("from 'react-native';", "from './platform.ts';")
    .replace("from './adapter';", "from './adapter.ts';")
    .replace("from './session';", "from './session.ts';");
}

function readTransportMarker(values: ReadonlyMap<string, string>): { attemptId: string } {
  const raw = values.get(TRANSPORT_ATTEMPT_KEY);
  if (!raw) throw new Error('Generated OAuth transport marker was not persisted.');
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value)) throw new Error('Generated OAuth transport marker is invalid.');
  const attemptId = Reflect.get(value, 'attemptId');
  if (typeof attemptId !== 'string') {
    throw new Error('Generated OAuth transport marker has an invalid shape.');
  }
  return { attemptId };
}

function hasPkceVerifier(values: ReadonlyMap<string, string>): boolean {
  return [...values.keys()].some((key) => key.endsWith('-code-verifier'));
}

function expireOwnerAttempt(values: Map<string, string>): void {
  const attemptKey = `${SESSION_STORAGE_KEY}.oauth.attempt`;
  const raw = values.get(attemptKey);
  if (!raw) throw new Error('Supabase OAuth attempt state was not persisted.');
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value)) throw new Error('Supabase OAuth attempt state is invalid.');
  values.set(attemptKey, JSON.stringify({ ...value, createdAt: 0, expiresAt: 1 }));
}

function expectedRejectedCallbackMessage(
  scenario: 'expired' | 'malformed' | 'mismatched' | 'missing',
): string {
  switch (scenario) {
    case 'expired':
      return 'The OAuth authorization attempt expired.';
    case 'malformed':
      return 'The OAuth callback URL is invalid.';
    case 'mismatched':
      return 'The OAuth authorization attempt was not found.';
    case 'missing':
      return 'The OAuth authorization attempt was not found or has expired.';
  }
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await Bun.sleep(5);
  }
  throw new Error('Timed out waiting for generated OAuth lifecycle state.');
}

function moduleUrl(filePath: string, label: string): string {
  return `${pathToFileURL(filePath).href}?${encodeURIComponent(label)}=${crypto.randomUUID()}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
