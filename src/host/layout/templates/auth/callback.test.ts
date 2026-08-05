import { expect, test } from 'bun:test';

import { getAuthOAuthCallbackTsx } from './callback';

test('generates a popup-free OAuth callback that completes once across effect replays', () => {
  const callback = getAuthOAuthCallbackTsx({
    signInRoute: 'sign-in',
    postSignInRoute: 'dashboard',
  });

  expect(callback).not.toContain("from 'expo-web-browser'");
  expect(callback).not.toContain('maybeCompleteAuthSession');
  expect(callback).not.toContain('window.closed');
  expect(callback).toContain(
    'let activeCallbackCompletion: ActiveCallbackCompletion | null = null;',
  );
  expect(callback).toContain('function completeOAuthCallbackOnce(callbackUrl: string)');
  expect(callback).toContain('promise: completeOAuthCallback(callbackUrl)');
  expect(callback).toContain('const outcome = await completeOAuthCallbackOnce(deliveredUrl);');
  expect(callback).toContain('const handledOutcomeRef = useRef(false);');
  expect(callback).toContain('if (!active || handledOutcomeRef.current) return;');
  expect(callback).toContain('router.replace(POST_SIGN_IN_ROUTE);');
  expect(callback.match(/completeOAuthCallback\(callbackUrl\)/gu)).toHaveLength(1);

  const transpiler = new Bun.Transpiler({ loader: 'tsx' });
  expect(() => transpiler.transformSync(callback)).not.toThrow();
});
