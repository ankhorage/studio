import { escapeStringLiteral } from '../../utils/escapeStringLiteral';
import { routeNameToGroupedHref } from '../utils/routes';

export function getAuthOAuthCallbackTsx(args: { signInRoute: string; postSignInRoute: string }) {
  const signInTarget = escapeStringLiteral(routeNameToGroupedHref(args.signInRoute, 'auth'));
  const postSignInTarget = escapeStringLiteral(routeNameToGroupedHref(args.postSignInRoute, 'app'));

  return `import { Text, useZoraTheme } from '@ankhorage/zora';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { completeOAuthCallback, resolveOAuthCallbackUrl } from '@/auth/oauth';

const SIGN_IN_ROUTE = '${signInTarget}';
const POST_SIGN_IN_ROUTE = '${postSignInTarget}';
const callbackScreenOptions = { title: 'Completing sign in' };

function useOAuthCallbackOutcome(callbackUrl: string | null) {
  const router = useRouter();
  const handledOutcomeRef = useRef(false);
  const [message, setMessage] = useState('Completing secure sign in…');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void completeCallbackRouteAsync({
      callbackUrl,
      handledOutcomeRef,
      router,
      setFailed,
      setMessage,
      signal: controller.signal,
    });

    return () => {
      controller.abort();
    };
  }, [callbackUrl, router]);

  return { failed, message };
}

export default function OAuthCallbackScreen() {
  const router = useRouter();
  const callbackParams = useLocalSearchParams<Record<string, string | string[]>>();
  const callbackUrl = useMemo(() => resolveCallbackUrl(callbackParams), [callbackParams]);
  const { failed, message } = useOAuthCallbackOutcome(callbackUrl);
  const { theme } = useZoraTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={callbackScreenOptions} />
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        {failed ? null : <ActivityIndicator color={theme.colors.primary} />}
        <Text variant="lead" weight="semiBold">
          {failed ? 'Sign in could not be completed' : 'Finishing sign in'}
        </Text>
        <Text emphasis="muted" variant="bodySmall">
          {message}
        </Text>
        {failed ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace(SIGN_IN_ROUTE)}
            style={[styles.button, { backgroundColor: theme.colors.primary }]}
          >
            <Text emphasis="inverse" weight="semiBold">
              Return to sign in
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

async function completeCallbackRouteAsync(args: {
  callbackUrl: string | null;
  handledOutcomeRef: { current: boolean };
  router: ReturnType<typeof useRouter>;
  setFailed: (failed: boolean) => void;
  setMessage: (message: string) => void;
  signal: AbortSignal;
}): Promise<void> {
  const { callbackUrl, handledOutcomeRef, router, setFailed, setMessage, signal } = args;
  if (!callbackUrl) {
    if (!signal.aborted && !handledOutcomeRef.current) {
      handledOutcomeRef.current = true;
      setFailed(true);
      setMessage('The OAuth callback URL could not be resolved.');
    }
    return;
  }

  const outcome = await completeOAuthCallback(callbackUrl);
  if (signal.aborted || handledOutcomeRef.current) return;
  handledOutcomeRef.current = true;
  if (outcome.status === 'authenticated') {
    if (outcome.completion === 'already-completed') {
      setMessage('This OAuth callback was already completed. Continuing…');
      await waitForCallbackStatusPaintAsync();
      if (hasCallbackAborted(signal)) return;
    }
    router.replace(POST_SIGN_IN_ROUTE);
    return;
  }
  setFailed(true);
  setMessage(outcome.message);
}

function resolveCallbackUrl(params: Record<string, string | string[]>): string | null {
  try {
    return resolveOAuthCallbackUrl(params);
  } catch {
    return null;
  }
}

function hasCallbackAborted(signal: AbortSignal): boolean {
  return signal.aborted;
}

function waitForCallbackStatusPaintAsync(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    gap: 16,
    maxWidth: 520,
    padding: 24,
    width: '100%',
  },
  button: {
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
});
`;
}
