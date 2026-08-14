import { expect, test } from 'bun:test';

import { getAuthOAuthRuntimeTs } from './oauth';

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

test('generates syntax-safe OAuth callback path normalization', () => {
  const runtime = createOAuthRuntime();

  expect(runtime).toContain('let callbackPath = OAUTH_CALLBACK_ROUTE;');
  expect(runtime).toContain("while (callbackPath.startsWith('/')) {");
  expect(runtime).toContain('callbackPath = callbackPath.slice(1);');
  expect(runtime).not.toContain("replace(/^/+/, '')");

  const transpiler = new Bun.Transpiler({ loader: 'ts' });
  expect(() => transpiler.transformSync(runtime)).not.toThrow();
});

test('generates full-page Web OAuth and preserves the native system browser', () => {
  const runtime = createOAuthRuntime();
  const webTransportStart = runtime.indexOf('async function redirectWebAuthorization');
  const callbackStart = runtime.indexOf('export async function completeOAuthCallback');
  const webTransport = runtime.slice(webTransportStart, callbackStart);

  expect(runtime).toContain("if (Platform.OS === 'web') {");
  expect(runtime).toContain('return redirectWebAuthorization({');
  expect(webTransport).toContain("Reflect.get(location, 'assign')");
  expect(webTransport).toContain('Reflect.apply(assign, location, [args.authorizationUrl]);');
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
  const preflight = runtime.indexOf('const runtimeReadiness = resolveExpoOAuthBrowserRuntimeReadiness();');
  const adapterStart = runtime.indexOf('const started = await oauth.startAuthorization({');

  expect(runtime).toContain("if (Platform.OS !== 'web') {");
  expect(preflight).toBeGreaterThan(-1);
  expect(adapterStart).toBeGreaterThan(preflight);
  expect(runtime).toContain("if (runtimeReadiness.status !== 'ready') {");
  expect(runtime).toContain('message: runtimeReadiness.message');
});

test('derives the Web callback from the current browser origin', () => {
  const runtime = createOAuthRuntime();

  expect(runtime).toContain(
    "const origin = location ? Reflect.get(location, 'origin') : undefined;",
  );
  expect(runtime).toContain('return new URL(`/${callbackPath}`, origin).toString();');
  expect(runtime).not.toMatch(/localhost:\d+/u);
  expect(runtime).not.toContain('window.closed');
});

test('derives native callbacks from canonical platform schemes', () => {
  const runtime = createOAuthRuntime({
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
  const runtime = createOAuthRuntime({});

  expect(runtime).toContain('android: undefined');
  expect(runtime).toContain('ios: undefined');
  expect(runtime).toContain(
    "throw new Error('Native OAuth requires a configured application scheme.');",
  );
});

test('generates adapter-owned OAuth lifecycle coordination with a correlation-only marker', () => {
  const runtime = createOAuthRuntime();

  expect(runtime).toContain("const OAUTH_TRANSPORT_ATTEMPT_KEY = 'ankh.auth.oauth.transport.v2';");
  expect(runtime).toContain(
    "const LEGACY_OAUTH_TRANSPORT_ATTEMPT_KEY = 'ankh.auth.oauth.transport.v1';",
  );
  expect(runtime).toContain(
    'interface StoredTransportAttempt {\n  version: 1;\n  attemptId: string;\n}',
  );
  expect(runtime).not.toContain('provider: AuthOAuthProviderId;');
  expect(runtime).toContain('getStoredAuthSession() && isCanonicalOAuthCallback(callbackUrl)');
  expect(runtime).toContain('await clearLegacyTransportAttempt();');
  expect(runtime).toContain('await clearTransportAttempt();');
});
