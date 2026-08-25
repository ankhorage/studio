import type { ExpoRuntimeNativeSchemeMap } from '@ankhorage/expo-runtime/planning';

import { escapeStringLiteral } from '../../utils/escapeStringLiteral';

export function getAuthOAuthCompletionTs(args: {
  callbackRoute: string;
  nativeSchemes: ExpoRuntimeNativeSchemeMap;
}) {
  const callbackRoute = escapeStringLiteral(args.callbackRoute);
  const androidScheme = serializeOptionalScheme(args.nativeSchemes.android);
  const iosScheme = serializeOptionalScheme(args.nativeSchemes.ios);

  return `import type { AuthOAuthCompletionResult } from '@ankhorage/contracts/auth';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { authAdapter } from './adapter';
import type { GeneratedOAuthTransportOutcome } from './oauth';
import { clearTransportAttempt, readTransportAttempt } from './oauth-state';
import { getStoredAuthSession } from './session';

const OAUTH_CALLBACK_ROUTE = '${callbackRoute}';
const GENERATED_NATIVE_SCHEMES = {
  android: ${androidScheme},
  ios: ${iosScheme},
} as const;

export type OAuthCallbackRouteParams = Readonly<Record<string, string | string[] | undefined>>;

const activeCallbackCompletions = new Map<string, Promise<GeneratedOAuthTransportOutcome>>();

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

export function completeOAuthCallback(
  callbackUrl: string,
): Promise<GeneratedOAuthTransportOutcome> {
  const activeCompletion = activeCallbackCompletions.get(callbackUrl);
  if (activeCompletion) return activeCompletion;

  const completion = completeOAuthCallbackAsync(callbackUrl);
  activeCallbackCompletions.set(callbackUrl, completion);
  void completion
    .finally(() => {
      if (activeCallbackCompletions.get(callbackUrl) === completion) {
        activeCallbackCompletions.delete(callbackUrl);
      }
    })
    .catch(() => {
      // The original promise remains the caller's error boundary.
    });
  return completion;
}

async function completeOAuthCallbackAsync(
  callbackUrl: string,
): Promise<GeneratedOAuthTransportOutcome> {
  const { oauth } = authAdapter;
  if (!oauth) return createUnavailableOAuthOutcome();
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
  return resolveCompletedOAuthOutcome(completed);
}

export function resolveOAuthRedirectUri(): string {
  let callbackPath = OAUTH_CALLBACK_ROUTE;
  while (callbackPath.startsWith('/')) callbackPath = callbackPath.slice(1);
  if (Platform.OS === 'web') return resolveWebOAuthRedirectUri(callbackPath);
  const nativeScheme =
    Platform.OS === 'android'
      ? GENERATED_NATIVE_SCHEMES.android
      : Platform.OS === 'ios'
        ? GENERATED_NATIVE_SCHEMES.ios
        : undefined;
  if (!nativeScheme) throw new Error('Native OAuth requires a configured application scheme.');
  return Linking.createURL(callbackPath, { scheme: nativeScheme });
}

function createUnavailableOAuthOutcome(): GeneratedOAuthTransportOutcome {
  return {
    status: 'error',
    message: 'OAuth is not available in this app configuration.',
    recoverable: true,
  };
}

function getBrowserLocation(): Readonly<Record<string, unknown>> | null {
  const location: unknown = Reflect.get(globalThis, 'location');
  return isRecord(location) ? location : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function resolveCompletedOAuthOutcome(
  completed: AuthOAuthCompletionResult,
): Promise<GeneratedOAuthTransportOutcome> {
  const hasStoredSession = getStoredAuthSession() !== null;
  if (
    !completed.ok &&
    completed.status === 'error' &&
    completed.error.code === 'callback_already_completed' &&
    hasStoredSession
  ) {
    return { status: 'authenticated', completion: 'already-completed' };
  }
  if (completed.ok) return toTransportOutcome(completed);
  const preservesAttempt =
    completed.status === 'error' && completed.error.code === 'invalid_callback' && hasStoredSession;
  if (!preservesAttempt) await clearTransportAttempt();
  return toTransportOutcome(completed);
}

function resolveWebOAuthRedirectUri(callbackPath: string): string {
  const origin = getBrowserLocation()?.origin;
  if (typeof origin !== 'string' || origin.length === 0) {
    throw new Error('Web OAuth requires a canonical browser origin.');
  }
  return new URL(\`/\${callbackPath}\`, origin).toString();
}

function toTransportOutcome(result: AuthOAuthCompletionResult): GeneratedOAuthTransportOutcome {
  if (result.ok) return { status: 'authenticated', completion: 'fresh' };
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
`;
}

function serializeOptionalScheme(scheme: string | undefined): string {
  return scheme === undefined ? 'undefined' : `'${escapeStringLiteral(scheme)}'`;
}
