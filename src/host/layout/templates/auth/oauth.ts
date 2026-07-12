import type { GeneratedOAuthProviderPlan } from '../../auth/resolveAuthLayoutPlan';
import { escapeStringLiteral } from '../../utils/escapeStringLiteral';

export function getAuthOAuthRuntimeTs(args: {
  callbackRoute: string;
  providers: readonly GeneratedOAuthProviderPlan[];
}) {
  const callbackRoute = escapeStringLiteral(args.callbackRoute);
  const providers = JSON.stringify(args.providers);

  return `import type {
  AuthOAuthCompletionResult,
  AuthOAuthProviderId,
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
const OAUTH_TRANSPORT_ATTEMPT_KEY = 'ankh.auth.oauth.transport.v1';
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
  attemptId: string;
  provider: AuthOAuthProviderId;
  redirectUri: string;
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

  const redirectUri = resolveOAuthRedirectUri();
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

  await writeTransportAttempt({
    attemptId: started.data.attemptId,
    provider: started.data.provider,
    redirectUri: started.data.redirectUri,
  });

  let browserResult: WebBrowser.WebBrowserAuthSessionResult;
  try {
    browserResult = await WebBrowser.openAuthSessionAsync(
      started.data.authorizationUrl,
      started.data.redirectUri,
    );
  } catch {
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

  const completed = await oauth.completeAuthorization({
    attemptId: attempt.attemptId,
    response: { type: 'callback', url: callbackUrl },
  });
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
  const callbackPath = OAUTH_CALLBACK_ROUTE.replace(/^\\/+/, '');
  if (Platform.OS === 'web') {
    const location = Reflect.get(globalThis, 'location');
    if (
      typeof location === 'object' &&
      location !== null &&
      typeof Reflect.get(location, 'origin') === 'string'
    ) {
      return new URL(\`/\${callbackPath}\`, Reflect.get(location, 'origin')).toString();
    }
    throw new Error('Web OAuth requires a canonical browser origin.');
  }

  return Linking.createURL(callbackPath);
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

async function writeTransportAttempt(attempt: StoredTransportAttempt): Promise<void> {
  await authSessionStorage.setItem(OAUTH_TRANSPORT_ATTEMPT_KEY, JSON.stringify(attempt));
}

async function readTransportAttempt(): Promise<StoredTransportAttempt | null> {
  const raw = await authSessionStorage.getItem(OAUTH_TRANSPORT_ATTEMPT_KEY);
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return null;
    const attemptId = Reflect.get(value, 'attemptId');
    const provider = Reflect.get(value, 'provider');
    const redirectUri = Reflect.get(value, 'redirectUri');
    return typeof attemptId === 'string' &&
      typeof provider === 'string' &&
      typeof redirectUri === 'string'
      ? { attemptId, provider, redirectUri }
      : null;
  } catch {
    return null;
  }
}

async function clearTransportAttempt(): Promise<void> {
  await authSessionStorage.removeItem(OAUTH_TRANSPORT_ATTEMPT_KEY);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
`;
}
