import { useZoraTheme, ZoraProvider } from '@ankhorage/zora';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

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
  const { theme } = useZoraTheme();

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <Slot />
      <StatusBar style="light" />
    </View>
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
});
