import { expect, test } from 'bun:test';

import { getAuthOAuthCallbackTsx } from './callback';

test('generates a router-owned OAuth callback that completes once across effect replays', () => {
  const callback = getAuthOAuthCallbackTsx({
    signInRoute: 'sign-in',
    postSignInRoute: 'dashboard',
  });

  expect(callback).not.toContain("from 'expo-web-browser'");
  expect(callback).not.toContain("from 'expo-linking'");
  expect(callback).not.toContain('maybeCompleteAuthSession');
  expect(callback).not.toContain('window.closed');
  expect(callback).not.toContain('Linking.useURL()');
  expect(callback).not.toContain('Linking.getInitialURL()');
  expect(callback).toContain('useLocalSearchParams<Record<string, string | string[]>>()');
  expect(callback).toContain('return resolveOAuthCallbackUrl(params);');
  expect(callback).toContain(
    'const callbackUrl = useMemo(() => resolveCallbackUrl(callbackParams), [callbackParams]);',
  );
  expect(callback).not.toContain('ActiveCallbackCompletion');
  expect(callback).not.toContain('completeOAuthCallbackOnce');
  expect(callback).toContain('const outcome = await completeOAuthCallback(callbackUrl);');
  expect(callback).toContain('const handledOutcomeRef = useRef(false);');
  expect(callback).toContain('if (signal.aborted || handledOutcomeRef.current) return;');
  expect(callback).toContain("outcome.completion === 'already-completed'");
  expect(callback).toContain('This OAuth callback was already completed. Continuing…');
  expect(callback).toContain('await waitForCallbackStatusPaintAsync();');
  expect(callback).toContain('router.replace(POST_SIGN_IN_ROUTE);');
  expect(callback.match(/completeOAuthCallback\(callbackUrl\)/gu)).toHaveLength(1);

  const transpiler = new Bun.Transpiler({ loader: 'tsx' });
  expect(() => transpiler.transformSync(callback)).not.toThrow();
});
