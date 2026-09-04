import { Icon, type IconProps, Text, useZoraTheme, ZoraProvider } from '@ankhorage/zora';
import { router, Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { resolveWorkspaceParentPath } from './workspace/navigation';
import { goBackFromWorkspaceRoute, replaceWorkspaceRoute } from './workspace/workspaceRouter';

export function StudioApp() {
  return (
    <SafeAreaProvider>
      <ZoraProvider initialMode="dark">
        <StudioAppRootContent />
      </ZoraProvider>
    </SafeAreaProvider>
  );
}

function StudioAppRootContent() {
  const { theme, mode, setMode } = useZoraTheme();
  const pathname = usePathname();
  const parentPath = resolveWorkspaceParentPath(pathname);

  function handleBack() {
    if (!parentPath) return;
    if (router.canGoBack()) {
      goBackFromWorkspaceRoute();
      return;
    }
    replaceWorkspaceRoute(parentPath);
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={[
          styles.appBar,
          { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border },
        ]}
      >
        {parentPath ? (
          <IconButton label="Back" iconName="chevron-back" onPress={handleBack} />
        ) : null}
        <AppBarBrand />
        <View style={styles.appBarActions}>
          <IconButton
            label={mode === 'dark' ? 'Use light mode' : 'Use dark mode'}
            iconName={mode === 'dark' ? 'sunny-outline' : 'moon-outline'}
            onPress={() => setMode(mode === 'dark' ? 'light' : 'dark')}
          />
        </View>
      </SafeAreaView>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
    </View>
  );
}

function AppBarBrand() {
  const { theme } = useZoraTheme();
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      onPress={() => replaceWorkspaceRoute('/')}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel="Go to projects"
      style={[styles.brand, { borderColor: focused ? theme.colors.primary : 'transparent' }]}
    >
      <Icon name="cube-outline" provider="Ionicons" size={22} color="primary" />
      <Text weight="semiBold">Ankh Studio</Text>
    </Pressable>
  );
}

type IoniconsIconName = Extract<IconProps, { provider?: 'Ionicons' }>['name'];

function IconButton(props: { label: string; iconName: IoniconsIconName; onPress: () => void }) {
  const { theme } = useZoraTheme();
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      onPress={props.onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={props.label}
      style={({ pressed }) => [
        styles.iconButton,
        {
          borderColor: focused ? theme.colors.primary : theme.colors.border,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <Icon name={props.iconName} provider="Ionicons" size={18} color="text" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    elevation: 0,
  },
  appBar: {
    minHeight: 56,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    zIndex: 2,
  },
  brand: {
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 8,
    flexShrink: 1,
  },
  appBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
