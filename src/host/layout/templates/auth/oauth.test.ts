import { expect, test } from 'bun:test';

import { getAuthOAuthRuntimeTs } from './oauth';

test('generates syntax-safe OAuth callback path normalization', () => {
  const runtime = getAuthOAuthRuntimeTs({
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

  expect(runtime).toContain('let callbackPath = OAUTH_CALLBACK_ROUTE;');
  expect(runtime).toContain("while (callbackPath.startsWith('/')) {");
  expect(runtime).toContain('callbackPath = callbackPath.slice(1);');
  expect(runtime).not.toContain("replace(/^/+/, '')");

  const transpiler = new Bun.Transpiler({ loader: 'ts' });
  expect(() => transpiler.transformSync(runtime)).not.toThrow();
});
