import { escapeStringLiteral } from '../../utils/escapeStringLiteral';
import { routeNameToGroupedHref } from '../utils/routes';

export function getAuthOAuthCallbackTsx(args: { signInRoute: string; postSignInRoute: string }) {
  const signInTarget = escapeStringLiteral(routeNameToGroupedHref(args.signInRoute, 'auth'));
  const postSignInTarget = escapeStringLiteral(routeNameToGroupedHref(args.postSignInRoute, 'app'));

  return `import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text, useZoraTheme } from '@ankhorage/zora';

import { completeOAuthCallback } from '@/auth/oauth';

const SIGN_IN_ROUTE = '${signInTarget}';
const POST_SIGN_IN_ROUTE = '${postSignInTarget}';
const callbackScreenOptions = { title: 'Completing sign in' };

interface ActiveCallbackCompletion {
  callbackUrl: string;
  promise: ReturnType<typeof completeOAuthCallback>;
}

let activeCallbackCompletion: ActiveCallbackCompletion | null = null;

function completeOAuthCallbackOnce(callbackUrl: string) {
  if (!activeCallbackCompletion || activeCallbackCompletion.callbackUrl !== callbackUrl) {
    activeCallbackCompletion = {
      callbackUrl,
      promise: completeOAuthCallback(callbackUrl),
    };
  }
  return activeCallbackCompletion.promise;
}

export default function OAuthCallbackScreen() {
  const router = useRouter();
  const callbackUrl = Linking.useURL();
  const { theme } = useZoraTheme();
  const handledOutcomeRef = useRef(false);
  const [message, setMessage] = useState('Completing secure sign in…');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const deliveredUrl = callbackUrl ?? (await Linking.getInitialURL());
      if (!deliveredUrl) {
        if (active && !handledOutcomeRef.current) {
          handledOutcomeRef.current = true;
          setFailed(true);
          setMessage('The OAuth callback URL is unavailable.');
        }
        return;
      }

      const outcome = await completeOAuthCallbackOnce(deliveredUrl);
      if (!active || handledOutcomeRef.current) return;
      handledOutcomeRef.current = true;

      if (outcome.status === 'authenticated') {
        router.replace(POST_SIGN_IN_ROUTE);
        return;
      }

      setFailed(true);
      setMessage(outcome.message);
    })();

    return () => {
      active = false;
    };
  }, [callbackUrl, router]);

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
            <Text color="inverse" weight="semiBold">
              Return to sign in
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
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
