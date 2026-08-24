import { resolveExpoRuntimePlan } from '@ankhorage/expo-runtime/planning';
import { EXPO_PLATFORM } from '@ankhorage/expo-runtime/platform';
import { describe, expect, it } from 'bun:test';

import { createExpo57CapabilityFixtureManifest } from './createExpo57CapabilityFixtureManifest';

describe('createExpo57CapabilityFixtureManifest', () => {
  it('plans the released scanner adapter and complete portable permission declaration', () => {
    const manifest = createExpo57CapabilityFixtureManifest();
    const plan = resolveExpoRuntimePlan(manifest);

    expect(plan.diagnostics).toEqual([]);
    expect(plan.runtimeAdapters).toEqual(['ExpoBarcodeScannerAdapter']);
    expect(plan.providers).toEqual(['permissions']);
    expect(plan.permissions.map(({ permission }) => permission)).toEqual([
      'camera',
      'clipboard',
      'locationBackground',
      'locationForeground',
      'mediaLibrary',
      'mediaLibraryWrite',
      'microphone',
      'notifications',
    ]);
    expect(plan.dependencies.map(({ name }) => name)).toEqual([
      '@ankhorage/expo-runtime',
      '@ankhorage/permissions',
      EXPO_PLATFORM.packages.audio.name,
      EXPO_PLATFORM.packages.camera.name,
      EXPO_PLATFORM.packages.location.name,
      EXPO_PLATFORM.packages.mediaLibrary.name,
      EXPO_PLATFORM.packages.notifications.name,
    ]);
    expect(plan.nativeConfig.plugins.map(({ name }) => name)).toEqual([
      EXPO_PLATFORM.packages.audio.name,
      EXPO_PLATFORM.packages.camera.name,
      EXPO_PLATFORM.packages.location.name,
      EXPO_PLATFORM.packages.mediaLibrary.name,
      EXPO_PLATFORM.packages.notifications.name,
    ]);
  });

  it('configures canonical OAuth schemes for both native targets', () => {
    const manifest = createExpo57CapabilityFixtureManifest();

    expect(manifest.infra.auth?.oauth).toMatchObject({
      callbackRoute: 'auth/callback',
      enabled: true,
      providers: [{ enabled: true, id: 'google' }],
    });
    expect(manifest.deploy?.targets.android?.scheme).toBe('ankh-expo57-capabilities-android');
    expect(manifest.deploy?.targets.ios?.scheme).toBe('ankh-expo57-capabilities-ios');
  });
});
