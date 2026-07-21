import { Icon, Text, useZoraTheme, ZoraProvider } from '@ankhorage/zora';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { Stack, router, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { useWorkspaceActions } from '../hooks/useWorkspaceActions';
import { resolveWorkspaceParentPath } from './workspace/navigation';

export function StudioApp() {
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

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
  const { installWorkspacePackages } = useWorkspaceActions();
  const pathname = usePathname();
  const parentPath = resolveWorkspaceParentPath(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const [installState, setInstallState] = useState<'idle' | 'running' | 'success' | 'error'>(
    'idle',
  );

  async function handleInstallWorkspacePackages() {
    setInstallState('running');
    setMenuOpen(false);
    try {
      await installWorkspacePackages();
      setInstallState('success');
    } catch (caught) {
      console.error(caught);
      setInstallState('error');
    }
  }

  function handleBack() {
    if (!parentPath) return;
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(parentPath);
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
          {installState === 'running' ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : installState === 'success' ? (
            <Text color="primary" variant="caption">
              Packages installed
            </Text>
          ) : installState === 'error' ? (
            <Text color="danger" variant="caption">
              Install failed
            </Text>
          ) : null}
          <IconButton
            label={mode === 'dark' ? 'Use light mode' : 'Use dark mode'}
            iconName={mode === 'dark' ? 'sunny-outline' : 'moon-outline'}
            onPress={() => setMode(mode === 'dark' ? 'light' : 'dark')}
          />
          <View>
            <IconButton
              label="Workspace menu"
              iconName="ellipsis-horizontal"
              onPress={() => setMenuOpen((open) => !open)}
            />
            {menuOpen ? (
              <View
                style={[
                  styles.workspaceMenu,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                ]}
              >
                <WorkspaceMenuItem
                  onPress={() => void handleInstallWorkspacePackages()}
                  disabled={installState === 'running'}
                />
              </View>
            ) : null}
          </View>
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
      onPress={() => router.replace('/')}
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

function IconButton(props: { label: string; iconName: string; onPress: () => void }) {
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

function WorkspaceMenuItem(props: { disabled: boolean; onPress: () => void }) {
  const { theme } = useZoraTheme();
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      onPress={props.onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      disabled={props.disabled}
      accessibilityRole="button"
      accessibilityLabel="Install workspace packages"
      style={[
        styles.workspaceMenuItem,
        { borderColor: focused ? theme.colors.primary : 'transparent' },
      ]}
    >
      <Icon name="download-outline" provider="Ionicons" size={16} color="primary" />
      <Text variant="bodySmall" weight="semiBold">
        Install workspace packages
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
    elevation: 0,
  },
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
  workspaceMenu: {
    position: 'absolute',
    right: 0,
    top: 44,
    minWidth: 230,
    borderWidth: 1,
    borderRadius: 8,
    padding: 6,
    zIndex: 3,
  },
  workspaceMenuItem: {
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },
});
