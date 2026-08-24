import type { ExpoRuntimeNativeSchemeMap } from '@ankhorage/expo-runtime/planning';

import type { AuthOAuthLayoutPlan } from '../../auth/resolveAuthLayoutPlan';
import { escapeStringLiteral } from '../../utils/escapeStringLiteral';

interface AuthOAuthRuntimeTemplateArgs extends AuthOAuthLayoutPlan {
  readonly nativeSchemes: ExpoRuntimeNativeSchemeMap;
}

export function getAuthOAuthRuntimeTs(args: AuthOAuthRuntimeTemplateArgs) {
  const callbackRoute = escapeStringLiteral(args.callbackRoute);
  const providers = serializeOAuthProviders(args.providers);
  const androidScheme =
    args.nativeSchemes.android === undefined
      ? 'undefined'
      : `'${escapeStringLiteral(args.nativeSchemes.android)}'`;
  const iosScheme =
    args.nativeSchemes.ios === undefined
      ? 'undefined'
      : `'${escapeStringLiteral(args.nativeSchemes.ios)}'`;

  return `import type {
  AuthOAuthCompletionResult,
  AuthOAuthTransportCancellationReason,
} from '@ankhorage/contracts/auth';
import {
  resolveExpoOAuthBrowserException,
  resolveExpoOAuthBrowserResult,
} from '@ankhorage/expo-runtime/oauth-browser';
import { resolveExpoOAuthBrowserRuntimeReadiness } from '@ankhorage/expo-runtime/oauth-browser-runtime';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { authAdapter } from './adapter';
import { authSessionStorage, getStoredAuthSession } from './session';

const OAUTH_CALLBACK_ROUTE = '${callbackRoute}';
const OAUTH_TRANSPORT_ATTEMPT_KEY = 'ankh.auth.oauth.transport';
const GENERATED_OAUTH_PROVIDERS = ${providers} as const;
const GENERATED_NATIVE_SCHEMES = {
  android: ${androidScheme},
  ios: ${iosScheme},
} as const;

export const generatedOAuthProviderItems = GENERATED_OAUTH_PROVIDERS.map((provider) => ({
  id: provider.id,
  label: provider.label,
  ...(provider.icon ? { icon: provider.icon } : {}),
}));

export type GeneratedOAuthTransportOutcome =
  | { status: 'authenticated' }
  | { status: 'cancelled'; message: string }
  | { status: 'error'; message: string; recoverable: boolean };

interface StoredTransportAttempt {
  attemptId: string;
}

export type OAuthCallbackRouteParams = Readonly<Record<string, string | string[] | undefined>>;

let activeAuthorization: Promise<GeneratedOAuthTransportOutcome> | null = null;

export function startOAuthAuthorization(
  providerId: string,
): Promise<GeneratedOAuthTransportOutcome> {
  activeAuthorization ??= runOAuthAuthorization(providerId).finally(() => {
    activeAuthorization = null;
  });
  return activeAuthorization;
}

async function runOAuthAuthorization(providerId: string): Promise<GeneratedOAuthTransportOutcome> {
  const oauth = authAdapter.oauth;
  if (!oauth) {
    return {
      status: 'error',
      message: 'OAuth is not available in this app configuration.',
      recoverable: true,
    };
  }

  const provider = GENERATED_OAUTH_PROVIDERS.find((entry) => entry.id === providerId);
  if (!provider) {
    return {
      status: 'error',
      message: 'This OAuth provider is not enabled.',
      recoverable: true,
    };
  }

  let redirectUri: string;
  try {
    redirectUri = resolveOAuthRedirectUri();
  } catch {
    return {
      status: 'error',
      message: 'The OAuth redirect URI could not be resolved in this environment.',
      recoverable: true,
    };
  }

  if (Platform.OS !== 'web') {
    const runtimeReadiness = resolveExpoOAuthBrowserRuntimeReadiness();
    if (runtimeReadiness.status !== 'ready') {
      return {
        status: 'error',
        message: runtimeReadiness.message,
        recoverable: true,
      };
    }
  }

  const started = await oauth.startAuthorization({
    provider: provider.id,
    redirectUri,
    scopes: provider.scopes,
    queryParams: provider.queryParams,
  });
  if (!started.ok) {
    return {
      status: 'error',
      message: started.error.message,
      recoverable: started.error.recoverable,
    };
  }

  try {
    await writeTransportAttempt({
      attemptId: started.data.attemptId,
    });
  } catch {
    await cancelOAuthAttempt(started.data.attemptId, 'user_cancelled');
    await clearTransportAttempt();
    return {
      status: 'error',
      message: 'The OAuth authorization attempt could not be persisted.',
      recoverable: true,
    };
  }

  if (Platform.OS === 'web') {
    return redirectWebAuthorization({
      attemptId: started.data.attemptId,
      authorizationUrl: started.data.authorizationUrl,
    });
  }

  let browserResponse;
  try {
    const browserResult = await WebBrowser.openAuthSessionAsync(
      started.data.authorizationUrl,
      started.data.redirectUri,
    );
    browserResponse = resolveExpoOAuthBrowserResult(browserResult);
  } catch {
    browserResponse = resolveExpoOAuthBrowserException();
  }

  if (browserResponse.type === 'callback') {
    return completeOAuthCallback(browserResponse.url);
  }

  let completed: AuthOAuthCompletionResult;
  try {
    completed = await oauth.completeAuthorization({
      attemptId: started.data.attemptId,
      response: browserResponse,
    });
  } catch {
    await clearTransportAttempt();
    return {
      status: 'error',
      message: 'The OAuth browser result could not be completed.',
      recoverable: true,
    };
  }
  await clearTransportAttempt();
  return toTransportOutcome(completed);
}

async function redirectWebAuthorization(args: {
  attemptId: string;
  authorizationUrl: string;
}): Promise<GeneratedOAuthTransportOutcome> {
  const location = getBrowserLocation();
  const assign = location ? Reflect.get(location, 'assign') : undefined;
  if (typeof assign !== 'function') {
    await cancelOAuthAttempt(args.attemptId, 'browser_dismissed');
    await clearTransportAttempt();
    return {
      status: 'error',
      message: 'Web OAuth requires full-page browser navigation.',
      recoverable: true,
    };
  }

  try {
    Reflect.apply(assign, location, [args.authorizationUrl]);
    return waitForFullPageNavigation();
  } catch {
    await cancelOAuthAttempt(args.attemptId, 'browser_dismissed');
    await clearTransportAttempt();
    return {
      status: 'error',
      message: 'The browser could not navigate to the OAuth provider.',
      recoverable: true,
    };
  }
}

function waitForFullPageNavigation(): Promise<never> {
  return new Promise<never>(() => {
    // Full-page navigation replaces this document before the promise settles.
  });
}

export function resolveOAuthCallbackUrl(params: OAuthCallbackRouteParams): string {
  const callbackUrl = new URL(resolveOAuthRedirectUri());
  for (const [name, value] of Object.entries(params)) {
    if (name === '#') continue;
    if (Array.isArray(value)) {
      for (const item of value) callbackUrl.searchParams.append(name, item);
      continue;
    }
    if (typeof value === 'string') callbackUrl.searchParams.append(name, value);
  }
  return callbackUrl.toString();
}

export async function completeOAuthCallback(
  callbackUrl: string,
): Promise<GeneratedOAuthTransportOutcome> {
  const oauth = authAdapter.oauth;
  if (!oauth) {
    return {
      status: 'error',
      message: 'OAuth is not available in this app configuration.',
      recoverable: true,
    };
  }

  const attempt = await readTransportAttempt();
  if (!attempt) {
    return {
      status: 'error',
      message: 'The OAuth authorization attempt was not found or has expired.',
      recoverable: true,
    };
  }

  let completed: AuthOAuthCompletionResult;
  try {
    completed = await oauth.completeAuthorization({
      attemptId: attempt.attemptId,
      response: { type: 'callback', url: callbackUrl },
    });
  } catch {
    await clearTransportAttempt();
    return {
      status: 'error',
      message: 'The OAuth callback could not be completed.',
      recoverable: true,
    };
  }

  const storedSession = getStoredAuthSession();

  if (
    !completed.ok &&
    completed.status === 'error' &&
    completed.error.code === 'callback_already_completed' &&
    storedSession
  ) {
    return { status: 'authenticated' };
  }

  const preservesCompletedAttempt =
    completed.ok ||
    (!completed.ok &&
      completed.status === 'error' &&
      completed.error.code === 'invalid_callback' &&
      storedSession !== null);
  if (!preservesCompletedAttempt) await clearTransportAttempt();

  return toTransportOutcome(completed);
}

function resolveOAuthRedirectUri(): string {
  let callbackPath = OAUTH_CALLBACK_ROUTE;
  while (callbackPath.startsWith('/')) {
    callbackPath = callbackPath.slice(1);
  }
  if (Platform.OS === 'web') {
    const location = getBrowserLocation();
    const origin = location ? Reflect.get(location, 'origin') : undefined;
    if (typeof origin === 'string' && origin.length > 0) {
      return new URL(\`/\${callbackPath}\`, origin).toString();
    }
    throw new Error('Web OAuth requires a canonical browser origin.');
  }

  const nativeScheme =
    Platform.OS === 'android'
      ? GENERATED_NATIVE_SCHEMES.android
      : Platform.OS === 'ios'
        ? GENERATED_NATIVE_SCHEMES.ios
        : undefined;
  if (!nativeScheme) {
    throw new Error('Native OAuth requires a configured application scheme.');
  }

  return Linking.createURL(callbackPath, { scheme: nativeScheme });
}

function getBrowserLocation(): object | null {
  const location = Reflect.get(globalThis, 'location');
  return typeof location === 'object' && location !== null ? location : null;
}

function toTransportOutcome(result: AuthOAuthCompletionResult): GeneratedOAuthTransportOutcome {
  if (result.ok) {
    return { status: 'authenticated' };
  }
  if (result.status === 'cancelled') {
    return {
      status: 'cancelled',
      message:
        result.reason === 'provider_denied'
          ? 'Authorization was declined by the provider.'
          : 'Authorization was cancelled.',
    };
  }
  return {
    status: 'error',
    message: result.error.message,
    recoverable: result.error.recoverable,
  };
}

async function cancelOAuthAttempt(
  attemptId: string,
  reason: AuthOAuthTransportCancellationReason,
): Promise<void> {
  const oauth = authAdapter.oauth;
  if (!oauth) return;
  try {
    await oauth.completeAuthorization({
      attemptId,
      response: { type: 'cancelled', reason },
    });
  } catch {
    // Best-effort cleanup must not replace the original transport error.
  }
}

async function writeTransportAttempt(attempt: StoredTransportAttempt): Promise<void> {
  await authSessionStorage.setItem(OAUTH_TRANSPORT_ATTEMPT_KEY, JSON.stringify(attempt));
}

async function readTransportAttempt(): Promise<StoredTransportAttempt | null> {
  const raw = await authSessionStorage.getItem(OAUTH_TRANSPORT_ATTEMPT_KEY);
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (isRecord(value)) {
      const attemptId = Reflect.get(value, 'attemptId');
      if (typeof attemptId === 'string' && attemptId.trim().length > 0) {
        return { attemptId };
      }
    }
  } catch {
    // Invalid transport state is cleaned below without exposing its contents.
  }
  await clearTransportAttempt();
  return null;
}

async function clearTransportAttempt(): Promise<void> {
  await safeRemoveTransportItem(OAUTH_TRANSPORT_ATTEMPT_KEY);
}

async function safeRemoveTransportItem(key: string): Promise<void> {
  try {
    await authSessionStorage.removeItem(key);
  } catch {
    // Cleanup failures are intentionally not surfaced with persisted state.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
`;
}

function serializeOAuthProviders(providers: AuthOAuthLayoutPlan['providers']): string {
  if (providers.length === 0) return '[]';
  const entries = providers.map((provider) => {
    const scopes = provider.scopes.map((scope) => `'${escapeStringLiteral(scope)}'`).join(', ');
    const queryParams = Object.entries(provider.queryParams)
      .flatMap(([name, value]) =>
        value === undefined
          ? []
          : [`${serializeObjectPropertyName(name)}: '${escapeStringLiteral(value)}'`],
      )
      .join(', ');
    const serializedQueryParams = queryParams.length > 0 ? `{ ${queryParams} }` : '{}';
    const icon = provider.icon ? `,\n    icon: ${serializeOAuthIcon(provider.icon)}` : '';
    return `  {
    id: '${escapeStringLiteral(provider.id)}',
    label: '${escapeStringLiteral(provider.label)}',
    scopes: [${scopes}],
    queryParams: ${serializedQueryParams}${icon},
  }`;
  });
  return `[\n${entries.join(',\n')},\n]`;
}

function serializeOAuthIcon(icon: NonNullable<AuthOAuthLayoutPlan['providers'][number]['icon']>) {
  const properties = Object.entries(icon).flatMap(([name, value]) => {
    if (value === undefined) return [];
    const serialized =
      typeof value === 'number' ? String(value) : `'${escapeStringLiteral(value)}'`;
    return [`${name}: ${serialized}`];
  });
  return `{ ${properties.join(', ')} }`;
}

function serializeObjectPropertyName(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(name) ? name : `'${escapeStringLiteral(name)}'`;
}
