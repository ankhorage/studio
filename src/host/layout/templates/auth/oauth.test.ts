import { expect, test } from 'bun:test';

import { getAuthOAuthRuntimeTs } from './oauth';

function createOAuthRuntime(): string {
  return getAuthOAuthRuntimeTs({
    callbackRoute: '/auth/callback',
    callbackRouteName: 'auth/callback',
    callbackTopLevelRouteName: 'auth',
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
  expect(runtime).toContain('return completeOAuthCallback(browserResult.url);');
  expect(runtime).toContain("message: 'Web OAuth requires full-page browser navigation.'");
  expect(runtime).toContain('recoverable: true');
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
