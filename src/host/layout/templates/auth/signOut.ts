export function getSignOutScreenTsx() {
  return `import { useZoraTheme } from '@ankhorage/zora';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { authAdapter } from '@/auth/adapter';
import { clearStoredAuthSession } from '@/auth/session';

const signOutScreenOptions = {
  title: 'Signing out',
};

export default function SignOutScreen() {
  const { theme } = useZoraTheme();

  useEffect(() => {
    void (async () => {
      try {
        await authAdapter.signOut();
      } finally {
        await clearStoredAuthSession();
      }
    })();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={signOutScreenOptions} />
      <ActivityIndicator color={theme.colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
});
`;
}
