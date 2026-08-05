import type { AuthOAuthLayoutPlan } from '../../auth/resolveAuthLayoutPlan';
import { escapeStringLiteral } from '../../utils/escapeStringLiteral';

export function getAuthOAuthRuntimeTs(args: AuthOAuthLayoutPlan) {
  const callbackRoute = escapeStringLiteral(args.callbackRoute);
  const providers = JSON.stringify(args.providers);

  return `import type {
  AuthOAuthCompletionResult,
  AuthOAuthTransportCancellationReason,
} from '@ankhorage/contracts/auth';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { authAdapter } from './adapter';
import {
  authSessionStorage,
  getStoredAuthSession,
} from './session';

const OAUTH_CALLBACK_ROUTE = '${callbackRoute}';
const OAUTH_TRANSPORT_ATTEMPT_KEY = 'ankh.auth.oauth.transport.v2';
const LEGACY_OAUTH_TRANSPORT_ATTEMPT_KEY = 'ankh.auth.oauth.transport.v1';
const GENERATED_OAUTH_PROVIDERS = ${providers} as const;

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
  version: 1;
  attemptId: string;
}

let activeAuthorization: Promise<GeneratedOAuthTransportOutcome> | null = null;

export function startOAuthAuthorization(
  providerId: string,
): Promise<GeneratedOAuthTransportOutcome> {
  activeAuthorization ??= runOAuthAuthorization(providerId).finally(() => {
    activeAuthorization = null;
  });
  return activeAuthorization;
}

async function runOAuthAuthorization(
  providerId: string,
): Promise<GeneratedOAuthTransportOutcome> {
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
      version: 1,
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

  let browserResult: WebBrowser.WebBrowserAuthSessionResult;
  try {
    browserResult = await WebBrowser.openAuthSessionAsync(
      started.data.authorizationUrl,
      started.data.redirectUri,
    );
  } catch {
    await cancelOAuthAttempt(started.data.attemptId, 'browser_dismissed');
    await clearTransportAttempt();
    return {
      status: 'error',
      message: 'The system authentication browser could not be opened.',
      recoverable: true,
    };
  }

  if (browserResult.type === 'success' && typeof browserResult.url === 'string') {
    return completeOAuthCallback(browserResult.url);
  }

  const cancellationReason =
    browserResult.type === 'dismiss' ? 'browser_dismissed' : 'user_cancelled';
  const completed = await oauth.completeAuthorization({
    attemptId: started.data.attemptId,
    response: { type: 'cancelled', reason: cancellationReason },
  });
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
    if (getStoredAuthSession() && isCanonicalOAuthCallback(callbackUrl)) {
      return { status: 'authenticated' };
    }
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
  await clearTransportAttempt();

  if (
    !completed.ok &&
    completed.status === 'error' &&
    completed.error.code === 'callback_already_completed' &&
    getStoredAuthSession()
  ) {
    return { status: 'authenticated' };
  }

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

  return Linking.createURL(callbackPath);
}

function isCanonicalOAuthCallback(callbackUrl: string): boolean {
  try {
    const delivered = new URL(callbackUrl);
    const expected = new URL(resolveOAuthRedirectUri());
    return (
      delivered.protocol === expected.protocol &&
      delivered.username === expected.username &&
      delivered.password === expected.password &&
      delivered.host === expected.host &&
      delivered.pathname === expected.pathname &&
      delivered.hash.length === 0
    );
  } catch {
    return false;
  }
}

function getBrowserLocation(): object | null {
  const location = Reflect.get(globalThis, 'location');
  return typeof location === 'object' && location !== null ? location : null;
}

function toTransportOutcome(
  result: AuthOAuthCompletionResult,
): GeneratedOAuthTransportOutcome {
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
  await clearLegacyTransportAttempt();
  await authSessionStorage.setItem(OAUTH_TRANSPORT_ATTEMPT_KEY, JSON.stringify(attempt));
}

async function readTransportAttempt(): Promise<StoredTransportAttempt | null> {
  const raw = await authSessionStorage.getItem(OAUTH_TRANSPORT_ATTEMPT_KEY);
  if (!raw) {
    await clearLegacyTransportAttempt();
    return null;
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (isRecord(value)) {
      const version = Reflect.get(value, 'version');
      const attemptId = Reflect.get(value, 'attemptId');
      if (version === 1 && typeof attemptId === 'string' && attemptId.trim().length > 0) {
        return { version, attemptId };
      }
    }
  } catch {
    // Invalid transport state is cleaned below without exposing its contents.
  }
  await clearTransportAttempt();
  return null;
}

async function clearTransportAttempt(): Promise<void> {
  await Promise.all([
    safeRemoveTransportItem(OAUTH_TRANSPORT_ATTEMPT_KEY),
    safeRemoveTransportItem(LEGACY_OAUTH_TRANSPORT_ATTEMPT_KEY),
  ]);
}

async function clearLegacyTransportAttempt(): Promise<void> {
  await safeRemoveTransportItem(LEGACY_OAUTH_TRANSPORT_ATTEMPT_KEY);
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
