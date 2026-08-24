import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it } from 'bun:test';

import { getAuthOAuthRuntimeTs } from './layout/templates/auth/oauth';
import { getAuthOAuthCompletionTs } from './layout/templates/auth/oauthCompletion';
import { getAuthOAuthStateTs } from './layout/templates/auth/oauthState';

const SESSION_STORAGE_KEY = 'generated.native.oauth.session';
const TRANSPORT_ATTEMPT_KEY = 'ankh.auth.oauth.transport';
const CALLBACK_URL = 'ankh-ios://auth/callback';
const EXPO_GO_MESSAGE =
  'Brokered OAuth requires a development or standalone build with the configured app scheme; Expo Go cannot provide a stable OAuth callback scheme.';
const temporaryRoots = new Set<string>();

type GeneratedOAuthOutcome =
  | { status: 'authenticated' }
  | { status: 'cancelled'; message: string }
  | { status: 'error'; message: string; recoverable: boolean };

type RuntimeReadiness =
  | { readonly status: 'ready' }
  | { readonly status: 'unsupported'; readonly reason: 'expo-go'; readonly message: string };

interface GeneratedOAuthRuntime {
  startOAuthAuthorization(providerId: string): Promise<GeneratedOAuthOutcome>;
}

interface HarnessState {
  readonly fetchCalls: { readonly body?: string; readonly url: string }[];
  readonly storageWrites: { readonly key: string; readonly value: string }[];
  readonly values: Map<string, string>;
  setBrowserResult(result: unknown): void;
  setBrowserThrows(value: boolean): void;
  setRuntimeReadiness(value: RuntimeReadiness): void;
}

interface NativeHarness {
  readonly state: HarnessState;
  importRuntime(): Promise<GeneratedOAuthRuntime>;
}

afterEach(async () => {
  await Promise.all(
    [...temporaryRoots].map(async (root) => {
      await rm(root, { force: true, recursive: true });
      temporaryRoots.delete(root);
    }),
  );
});

describe('generated native OAuth lifecycle', () => {
  it('exchanges a native callback once and persists the authenticated session', async () => {
    const harness = await createHarness();
    harness.state.setBrowserResult({ type: 'success', url: `${CALLBACK_URL}?code=opaque-code` });

    const result = await (await harness.importRuntime()).startOAuthAuthorization('google');

    expect(result).toEqual({ status: 'authenticated' });
    expect(harness.state.fetchCalls).toHaveLength(1);
    expect(harness.state.fetchCalls[0]?.url).toContain('/auth/v1/token?grant_type=pkce');
    expect(harness.state.values.has(SESSION_STORAGE_KEY)).toBe(true);
    expect(harness.state.values.has(TRANSPORT_ATTEMPT_KEY)).toBe(true);
    expect(hasPkceVerifier(harness.state.values)).toBe(false);
  });

  it('rejects Expo Go before the adapter creates PKCE or transport state', async () => {
    const harness = await createHarness();
    harness.state.setRuntimeReadiness({
      status: 'unsupported',
      reason: 'expo-go',
      message: EXPO_GO_MESSAGE,
    });

    const result = await (await harness.importRuntime()).startOAuthAuthorization('google');

    expect(result).toEqual({
      status: 'error',
      message: EXPO_GO_MESSAGE,
      recoverable: true,
    });
    expect(harness.state.fetchCalls).toHaveLength(0);
    expect(harness.state.storageWrites).toHaveLength(0);
    expect(harness.state.values.has(TRANSPORT_ATTEMPT_KEY)).toBe(false);
    expect(hasPkceVerifier(harness.state.values)).toBe(false);
  });

  it.each([
    ['cancel', 'Authorization was cancelled.'],
    ['dismiss', 'Authorization was cancelled.'],
  ] as const)('finalizes %s without exchanging a code', async (type, message) => {
    const harness = await createHarness();
    harness.state.setBrowserResult({ type });

    const result = await (await harness.importRuntime()).startOAuthAuthorization('google');

    expect(result).toEqual({ status: 'cancelled', message });
    expect(harness.state.fetchCalls).toHaveLength(0);
    expect(harness.state.values.has(TRANSPORT_ATTEMPT_KEY)).toBe(false);
    expect(hasPkceVerifier(harness.state.values)).toBe(false);
  });

  it.each(['locked', 'opened'] as const)('finalizes %s as a transport error', async (type) => {
    const harness = await createHarness();
    harness.state.setBrowserResult({ type });

    const result = await (await harness.importRuntime()).startOAuthAuthorization('google');

    expect(result).toEqual({
      status: 'error',
      message: 'The OAuth authorization transport failed.',
      recoverable: true,
    });
    expect(harness.state.fetchCalls).toHaveLength(0);
    expect(harness.state.values.has(TRANSPORT_ATTEMPT_KEY)).toBe(false);
    expect(hasPkceVerifier(harness.state.values)).toBe(false);
  });

  it('finalizes a rejected browser invocation as a transport error', async () => {
    const harness = await createHarness();
    harness.state.setBrowserThrows(true);

    const result = await (await harness.importRuntime()).startOAuthAuthorization('google');

    expect(result).toEqual({
      status: 'error',
      message: 'The OAuth authorization transport failed.',
      recoverable: true,
    });
    expect(harness.state.fetchCalls).toHaveLength(0);
    expect(harness.state.values.has(TRANSPORT_ATTEMPT_KEY)).toBe(false);
    expect(hasPkceVerifier(harness.state.values)).toBe(false);
  });
});

async function createHarness(): Promise<NativeHarness> {
  const root = await mkdtemp(path.join(tmpdir(), 'ankh-generated-native-oauth-'));
  temporaryRoots.add(root);
  await symlink(path.join(process.cwd(), 'node_modules'), path.join(root, 'node_modules'), 'dir');
  await writeState(root);
  await writeDocument(root);

  const state = (await import(moduleUrl(path.join(root, 'state.ts')))) as HarnessState;
  return {
    state,
    importRuntime: async () =>
      (await import(moduleUrl(path.join(root, 'oauth.ts')))) as GeneratedOAuthRuntime,
  };
}

async function writeState(root: string): Promise<void> {
  await writeFile(
    path.join(root, 'state.ts'),
    `export const values = new Map<string, string>();\n` +
      `export const storageWrites: { key: string; value: string }[] = [];\n` +
      `export const fetchCalls: { body?: string; url: string }[] = [];\n` +
      `let browserResult: unknown = { type: 'dismiss' };\n` +
      `let browserThrows = false;\n` +
      `let runtimeReadiness = { status: 'ready' } as const;\n` +
      `export const getBrowserResult = () => browserResult;\n` +
      `export const getBrowserThrows = () => browserThrows;\n` +
      `export const getRuntimeReadiness = () => runtimeReadiness;\n` +
      `export const setBrowserResult = (value: unknown) => { browserResult = value; };\n` +
      `export const setBrowserThrows = (value: boolean) => { browserThrows = value; };\n` +
      `export const setRuntimeReadiness = (value: typeof runtimeReadiness | { status: 'unsupported'; reason: 'expo-go'; message: string }) => { runtimeReadiness = value as typeof runtimeReadiness; };\n`,
  );
}

async function writeDocument(root: string): Promise<void> {
  await mkdir(root, { recursive: true });
  await Promise.all([
    writeFile(path.join(root, 'oauth.ts'), createGeneratedOAuthSource()),
    writeFile(path.join(root, 'oauth-completion.ts'), createGeneratedOAuthCompletionSource()),
    writeFile(path.join(root, 'oauth-state.ts'), createGeneratedOAuthStateSource()),
    writeFile(path.join(root, 'session.ts'), createSessionSource()),
    writeFile(path.join(root, 'adapter.ts'), createAdapterSource()),
    writeFile(
      path.join(root, 'runtimeReadiness.ts'),
      `import { getRuntimeReadiness } from './state.ts';\n` +
        `export const resolveExpoOAuthBrowserRuntimeReadiness = getRuntimeReadiness;\n`,
    ),
    writeFile(
      path.join(root, 'linking.ts'),
      `export const createURL = (path: string, options?: { scheme?: string }) =>\n` +
        `  \`\${options?.scheme ?? 'ankh'}://\${path}\`;\n`,
    ),
    writeFile(
      path.join(root, 'webBrowser.ts'),
      `import { getBrowserResult, getBrowserThrows } from './state.ts';\n` +
        `export async function openAuthSessionAsync(): Promise<unknown> {\n` +
        `  if (getBrowserThrows()) throw new Error('browser unavailable');\n` +
        `  return getBrowserResult();\n` +
        `}\n`,
    ),
    writeFile(path.join(root, 'platform.ts'), `export const Platform = { OS: 'ios' };\n`),
  ]);
}

function createGeneratedOAuthSource(): string {
  return getAuthOAuthRuntimeTs({
    callbackRoute: '/auth/callback',
    callbackRouteName: 'auth/callback',
    callbackTopLevelRouteName: 'auth',
    nativeSchemes: { ios: 'ankh-ios' },
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
    .replace("from 'expo-web-browser';", "from './webBrowser.ts';")
    .replace("from 'react-native';", "from './platform.ts';")
    .replace("from './adapter';", "from './adapter.ts';");
}

function createGeneratedOAuthCompletionSource(): string {
  return getAuthOAuthCompletionTs({
    callbackRoute: '/auth/callback',
    nativeSchemes: { ios: 'ankh-ios' },
  })
    .replace("from 'expo-linking';", "from './linking.ts';")
    .replace("from 'react-native';", "from './platform.ts';")
    .replace("from './adapter';", "from './adapter.ts';")
    .replace("from './oauth';", "from './oauth.ts';")
    .replace("from './oauth-state';", "from './oauth-state.ts';")
    .replace("from './session';", "from './session.ts';");
}

function createGeneratedOAuthStateSource(): string {
  return getAuthOAuthStateTs().replace("from './session';", "from './session.ts';");
}

function createSessionSource(): string {
  return (
    `import { storageWrites, values } from './state.ts';\n\n` +
    `export const AUTH_SESSION_STORAGE_KEY = '${SESSION_STORAGE_KEY}';\n` +
    `export const authSessionStorage = {\n` +
    `  getItem: (key: string) => values.get(key) ?? null,\n` +
    `  setItem: (key: string, value: string) => { storageWrites.push({ key, value }); values.set(key, value); },\n` +
    `  removeItem: (key: string) => { values.delete(key); },\n` +
    `};\n\n` +
    `export function getStoredAuthSession() {\n` +
    `  return values.has(AUTH_SESSION_STORAGE_KEY) ? { user: { id: 'user-1' } } : null;\n` +
    `}\n`
  );
}

function createAdapterSource(): string {
  return (
    `import { createSupabaseAuthAdapter } from '@ankhorage/supabase-auth';\n` +
    `import { fetchCalls } from './state.ts';\n` +
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
    `      access_token: 'access-token', refresh_token: 'refresh-token', expires_in: 3600,\n` +
    `      token_type: 'bearer', user: { id: 'user-1', email: 'person@example.com',\n` +
    `      app_metadata: {}, user_metadata: {}, aud: 'authenticated' },\n` +
    `    }), { status: 200, headers: { 'content-type': 'application/json' } }));\n` +
    `  },\n` +
    `});\n`
  );
}

function hasPkceVerifier(values: ReadonlyMap<string, string>): boolean {
  return [...values.keys()].some((key) => key.endsWith('-code-verifier'));
}

function moduleUrl(filePath: string): string {
  return `${pathToFileURL(filePath).href}?test=${crypto.randomUUID()}`;
}
