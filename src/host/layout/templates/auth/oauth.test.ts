import { expect, test } from 'bun:test';

import { getAuthOAuthRuntimeTs } from './oauth';
import { getAuthOAuthCompletionTs } from './oauthCompletion';
import { getAuthOAuthStateTs } from './oauthState';

function createOAuthRuntime(
  nativeSchemes: { readonly android?: string; readonly ios?: string } = {
    android: 'ankh-android',
    ios: 'ankh-ios',
  },
): string {
  return getAuthOAuthRuntimeTs({
    callbackRoute: '/auth/callback',
    callbackRouteName: 'auth/callback',
    callbackTopLevelRouteName: 'auth',
    nativeSchemes,
    providers: [
      {
        id: 'google',
        label: 'Google',
        scopes: ['openid', 'email', 'profile'],
        queryParams: {},
      },
    ],
  });
}

function createOAuthCompletion(
  nativeSchemes: { readonly android?: string; readonly ios?: string } = {
    android: 'ankh-android',
    ios: 'ankh-ios',
  },
): string {
  return getAuthOAuthCompletionTs({ callbackRoute: '/auth/callback', nativeSchemes });
}

test('generates syntax-safe OAuth callback path normalization', () => {
  const runtime = createOAuthCompletion();

  expect(runtime).toContain('const activeCallbackCompletions = new Map<');
  expect(runtime).toContain('const completion = completeOAuthCallbackAsync(callbackUrl);');
  expect(runtime).toContain('activeCallbackCompletions.set(callbackUrl, completion);');
  expect(runtime).toContain('if (activeCallbackCompletions.get(callbackUrl) === completion) {');
  expect(runtime).toContain('activeCallbackCompletions.delete(callbackUrl);');
  expect(runtime).toContain('let callbackPath = OAUTH_CALLBACK_ROUTE;');
  expect(runtime).toContain(
    "while (callbackPath.startsWith('/')) callbackPath = callbackPath.slice(1);",
  );
  expect(runtime).not.toContain("replace(/^/+/, '')");

  const transpiler = new Bun.Transpiler({ loader: 'ts' });
  expect(() => transpiler.transformSync(runtime)).not.toThrow();
});

test('serializes free-form OAuth query parameter names as syntax-safe properties', () => {
  const runtime = getAuthOAuthRuntimeTs({
    callbackRoute: '/auth/callback',
    callbackRouteName: 'auth/callback',
    callbackTopLevelRouteName: 'auth',
    nativeSchemes: {},
    providers: [
      {
        id: 'google',
        label: 'Google',
        scopes: ['openid'],
        queryParams: { 'access-type': 'offline' },
      },
    ],
  });

  expect(runtime).toContain("queryParams: { 'access-type': 'offline' }");
  const transpiler = new Bun.Transpiler({ loader: 'ts' });
  expect(() => transpiler.transformSync(runtime)).not.toThrow();
});

test('generates full-page Web OAuth and preserves the native system browser', () => {
  const runtime = createOAuthRuntime();
  const webTransportStart = runtime.indexOf('async function redirectWebAuthorization');
  const webTransport = runtime.slice(webTransportStart);

  expect(runtime).toContain("if (Platform.OS === 'web') {");
  expect(runtime).toContain('return redirectWebAuthorization({');
  expect(webTransport).toContain('location.assign(args.authorizationUrl);');
  expect(webTransport).toContain('return waitForFullPageNavigation();');
  expect(webTransport).not.toContain('openAuthSessionAsync');
  expect(webTransport).not.toContain('window.closed');

  expect(runtime).toContain('browserResult = await WebBrowser.openAuthSessionAsync(');
  expect(runtime).toContain("from '@ankhorage/expo-runtime/oauth-browser';");
  expect(runtime).toContain("from '@ankhorage/expo-runtime/oauth-browser-runtime';");
  expect(runtime).toContain('browserResponse = resolveExpoOAuthBrowserResult(browserResult);');
  expect(runtime).toContain('browserResponse = resolveExpoOAuthBrowserException();');
  expect(runtime).toContain('response: browserResponse');
  expect(runtime).not.toContain("browserResult.type === 'dismiss'");
  expect(runtime).toContain("message: 'Web OAuth requires full-page browser navigation.'");
  expect(runtime).toContain('recoverable: true');
});

test('preflights native OAuth before the adapter creates an authorization attempt', () => {
  const runtime = createOAuthRuntime();
  const preflight = runtime.indexOf(
    'const runtimeReadiness = resolveExpoOAuthBrowserRuntimeReadiness();',
  );
  const adapterStart = runtime.indexOf('const started = await context.oauth.startAuthorization({');

  expect(runtime).toContain("if (Platform.OS !== 'web') {");
  expect(preflight).toBeGreaterThan(-1);
  expect(adapterStart).toBeGreaterThan(preflight);
  expect(runtime).toContain("if (runtimeReadiness.status !== 'ready') {");
  expect(runtime).toContain('message: runtimeReadiness.message');
});

test('derives the Web callback from the current browser origin', () => {
  const runtime = createOAuthCompletion();

  expect(runtime).toContain('const origin = getBrowserLocation()?.origin;');
  expect(runtime).toContain('return new URL(`/${callbackPath}`, origin).toString();');
  expect(runtime).not.toMatch(/localhost:\d+/u);
  expect(runtime).not.toContain('window.closed');
});

test('derives native callbacks from canonical platform schemes', () => {
  const runtime = createOAuthCompletion({
    android: 'ankh-android-auth',
    ios: 'ankh-ios-auth',
  });

  expect(runtime).toContain("android: 'ankh-android-auth'");
  expect(runtime).toContain("ios: 'ankh-ios-auth'");
  expect(runtime).toContain("Platform.OS === 'android'");
  expect(runtime).toContain("Platform.OS === 'ios'");
  expect(runtime).toContain('return Linking.createURL(callbackPath, { scheme: nativeScheme });');
  expect(runtime).not.toContain('return Linking.createURL(callbackPath);');
});

test('does not invent a native callback scheme when none is configured', () => {
  const runtime = createOAuthCompletion({});

  expect(runtime).toContain('android: undefined');
  expect(runtime).toContain('ios: undefined');
  expect(runtime).toContain(
    "throw new Error('Native OAuth requires a configured application scheme.');",
  );
});

test('reconstructs the canonical callback URL from router-owned search params', () => {
  const runtime = createOAuthCompletion();

  expect(runtime).toContain(
    'export function resolveOAuthCallbackUrl(params: OAuthCallbackRouteParams)',
  );
  expect(runtime).toContain('const callbackUrl = new URL(resolveOAuthRedirectUri());');
  expect(runtime).toContain('for (const [name, value] of Object.entries(params)) {');
  expect(runtime).toContain("if (name === '#') continue;");
  expect(runtime).toContain('callbackUrl.searchParams.append(name, item);');
  expect(runtime).toContain('callbackUrl.searchParams.append(name, value);');
  expect(runtime).toContain('return callbackUrl.toString();');
});

test('generates one canonical correlation marker without legacy transport state', () => {
  const runtime = `${createOAuthRuntime()}\n${createOAuthCompletion()}\n${getAuthOAuthStateTs()}`;

  expect(runtime).toContain("const OAUTH_TRANSPORT_ATTEMPT_KEY = 'ankh.auth.oauth.transport';");
  expect(runtime).not.toContain('LEGACY_OAUTH_TRANSPORT_ATTEMPT_KEY');
  expect(runtime).not.toContain('ankh.auth.oauth.transport.v1');
  expect(runtime).not.toContain('ankh.auth.oauth.transport.v2');
  expect(runtime).toContain('interface StoredTransportAttempt {\n  attemptId: string;\n}');
  expect(runtime).not.toContain('version: 1;');
  expect(runtime).not.toContain('provider: AuthOAuthProviderId;');
  expect(runtime).not.toContain('isCanonicalOAuthCallback');
  expect(runtime).toContain("completed.error.code === 'callback_already_completed'");
  expect(runtime).toContain("completion: 'already-completed'");
  expect(runtime).toContain("completed.error.code === 'invalid_callback'");
  expect(runtime).toContain('await clearTransportAttempt();');
  expect(runtime).not.toContain('clearLegacyTransportAttempt');
});
