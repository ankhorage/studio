import type { ExpoRuntimeNativeSchemeMap } from '@ankhorage/expo-runtime/planning';

import type { AuthOAuthLayoutPlan } from '../../auth/resolveAuthLayoutPlan';
import { escapeStringLiteral } from '../../utils/escapeStringLiteral';

interface AuthOAuthRuntimeTemplateArgs extends AuthOAuthLayoutPlan {
  readonly nativeSchemes: ExpoRuntimeNativeSchemeMap;
}

export function getAuthOAuthRuntimeTs(args: AuthOAuthRuntimeTemplateArgs) {
  const providers = serializeOAuthProviders(args.providers);

  return `import type {
  AuthOAuthCompletionResult,
  AuthOAuthTransportCancellationReason,
} from '@ankhorage/contracts/auth';
import {
  resolveExpoOAuthBrowserException,
  resolveExpoOAuthBrowserResult,
} from '@ankhorage/expo-runtime/oauth-browser';
import { resolveExpoOAuthBrowserRuntimeReadiness } from '@ankhorage/expo-runtime/oauth-browser-runtime';
import type { OAuthProviderIconSpec } from '@ankhorage/zora';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { authAdapter } from './adapter';
import {
  completeOAuthCallback,
  resolveOAuthCallbackUrl,
  resolveOAuthRedirectUri,
} from './oauth-completion';
import { clearTransportAttempt, writeTransportAttempt } from './oauth-state';

const GENERATED_OAUTH_PROVIDERS: readonly GeneratedOAuthProvider[] = ${providers};

export const generatedOAuthProviderItems = GENERATED_OAUTH_PROVIDERS.map((provider) => ({
  id: provider.id,
  label: provider.label,
  ...(provider.icon ? { icon: provider.icon } : {}),
}));

export type GeneratedOAuthTransportOutcome =
  | { status: 'authenticated'; completion: 'fresh' | 'already-completed' }
  | { status: 'cancelled'; message: string }
  | { status: 'error'; message: string; recoverable: boolean };

interface GeneratedOAuthProvider {
  readonly id: 'google' | 'apple';
  readonly label: string;
  readonly scopes: readonly string[];
  readonly queryParams: Readonly<Record<string, string>>;
  readonly icon?: OAuthProviderIconSpec;
}

export { completeOAuthCallback, resolveOAuthCallbackUrl };

let activeAuthorization: Promise<GeneratedOAuthTransportOutcome> | null = null;

type GeneratedOAuthAdapter = NonNullable<(typeof authAdapter)['oauth']>;

interface OAuthAuthorizationContext {
  oauth: GeneratedOAuthAdapter;
  provider: GeneratedOAuthProvider;
  redirectUri: string;
}

interface StartedOAuthAuthorization {
  attemptId: string;
  authorizationUrl: string;
  redirectUri: string;
}

export function startOAuthAuthorization(
  providerId: string,
): Promise<GeneratedOAuthTransportOutcome> {
  activeAuthorization ??= runOAuthAuthorization(providerId).finally(() => {
    activeAuthorization = null;
  });
  return activeAuthorization;
}

async function runOAuthAuthorization(providerId: string): Promise<GeneratedOAuthTransportOutcome> {
  const resolved = resolveAuthorizationContext(providerId);
  if ('outcome' in resolved) return resolved.outcome;
  const started = await startAuthorizationAttemptAsync(resolved.context);
  if ('outcome' in started) return started.outcome;
  return completeAuthorizationTransportAsync(resolved.context.oauth, started.authorization);
}

function resolveAuthorizationContext(
  providerId: string,
): { context: OAuthAuthorizationContext } | { outcome: GeneratedOAuthTransportOutcome } {
  const { oauth } = authAdapter;
  if (!oauth) {
    return {
      outcome: {
        status: 'error',
        message: 'OAuth is not available in this app configuration.',
        recoverable: true,
      },
    };
  }

  const provider = GENERATED_OAUTH_PROVIDERS.find((entry) => entry.id === providerId);
  if (!provider) {
    return {
      outcome: {
        status: 'error',
        message: 'This OAuth provider is not enabled.',
        recoverable: true,
      },
    };
  }

  try {
    return { context: { oauth, provider, redirectUri: resolveOAuthRedirectUri() } };
  } catch {
    return {
      outcome: {
        status: 'error',
        message: 'The OAuth redirect URI could not be resolved in this environment.',
        recoverable: true,
      },
    };
  }
}

async function startAuthorizationAttemptAsync(
  context: OAuthAuthorizationContext,
): Promise<
  { authorization: StartedOAuthAuthorization } | { outcome: GeneratedOAuthTransportOutcome }
> {
  if (Platform.OS !== 'web') {
    const runtimeReadiness = resolveExpoOAuthBrowserRuntimeReadiness();
    if (runtimeReadiness.status !== 'ready') {
      return {
        outcome: {
          status: 'error',
          message: runtimeReadiness.message,
          recoverable: true,
        },
      };
    }
  }

  const started = await context.oauth.startAuthorization({
    provider: context.provider.id,
    redirectUri: context.redirectUri,
    scopes: [...context.provider.scopes],
    queryParams: { ...context.provider.queryParams },
  });
  if (!started.ok) {
    return {
      outcome: {
        status: 'error',
        message: started.error.message,
        recoverable: started.error.recoverable,
      },
    };
  }

  try {
    await writeTransportAttempt({ attemptId: started.data.attemptId });
  } catch {
    await cancelOAuthAttempt(context.oauth, started.data.attemptId, 'user_cancelled');
    await clearTransportAttempt();
    return {
      outcome: {
        status: 'error',
        message: 'The OAuth authorization attempt could not be persisted.',
        recoverable: true,
      },
    };
  }

  return { authorization: started.data };
}

async function completeAuthorizationTransportAsync(
  oauth: GeneratedOAuthAdapter,
  started: StartedOAuthAuthorization,
): Promise<GeneratedOAuthTransportOutcome> {
  if (Platform.OS === 'web') {
    return redirectWebAuthorization({
      attemptId: started.attemptId,
      authorizationUrl: started.authorizationUrl,
      oauth,
    });
  }

  let browserResponse;
  try {
    const browserResult = await WebBrowser.openAuthSessionAsync(
      started.authorizationUrl,
      started.redirectUri,
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
      attemptId: started.attemptId,
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
  oauth: GeneratedOAuthAdapter;
}): Promise<GeneratedOAuthTransportOutcome> {
  const location = getBrowserLocation();
  if (!hasBrowserLocationAssign(location)) {
    await cancelOAuthAttempt(args.oauth, args.attemptId, 'browser_dismissed');
    await clearTransportAttempt();
    return {
      status: 'error',
      message: 'Web OAuth requires full-page browser navigation.',
      recoverable: true,
    };
  }

  try {
    location.assign(args.authorizationUrl);
    return waitForFullPageNavigation();
  } catch {
    await cancelOAuthAttempt(args.oauth, args.attemptId, 'browser_dismissed');
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

function getBrowserLocation(): Readonly<Record<string, unknown>> | null {
  const location: unknown = Reflect.get(globalThis, 'location');
  return isRecord(location) ? location : null;
}

function hasBrowserLocationAssign(
  location: Readonly<Record<string, unknown>> | null,
): location is Readonly<Record<string, unknown>> & { assign: (url: string) => void } {
  return location !== null && typeof location.assign === 'function';
}

function toTransportOutcome(result: AuthOAuthCompletionResult): GeneratedOAuthTransportOutcome {
  if (result.ok) {
    return { status: 'authenticated', completion: 'fresh' };
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
  oauth: GeneratedOAuthAdapter,
  attemptId: string,
  reason: AuthOAuthTransportCancellationReason,
): Promise<void> {
  try {
    await oauth.completeAuthorization({
      attemptId,
      response: { type: 'cancelled', reason },
    });
  } catch {
    // Best-effort cleanup must not replace the original transport error.
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
