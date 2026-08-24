import type { AnkhoragePermissionName, AppManifest } from '@ankhorage/contracts';
import { createOAuthFixtureManifest } from '@ankhorage/templates';

const EXPO57_CAPABILITY_PERMISSIONS = [
  'camera',
  'clipboard',
  'locationBackground',
  'locationForeground',
  'mediaLibrary',
  'mediaLibraryWrite',
  'microphone',
  'notifications',
] as const satisfies readonly AnkhoragePermissionName[];

export function createExpo57CapabilityFixtureManifest(): AppManifest {
  const manifest = createOAuthFixtureManifest({
    category: 'developer_tools',
    fixture: 'google',
    overrides: {
      metadata: {
        name: 'Expo 57 Generated Capability Acceptance',
        slug: 'expo-57-generated-capability-acceptance',
      },
    },
  });

  return {
    ...manifest,
    deploy: {
      targets: {
        android: {
          enabled: true,
          package: 'com.ankhorage.expo57capabilities',
          scheme: 'ankh-expo57-capabilities-android',
        },
        ios: {
          bundleIdentifier: 'com.ankhorage.expo57capabilities',
          enabled: true,
          scheme: 'ankh-expo57-capabilities-ios',
        },
        web: { enabled: true },
      },
    },
    navigator: {
      type: 'stack',
      initialRouteName: 'index',
      routes: [{ name: 'index', screenId: 'capability-acceptance' }],
    },
    screens: {
      'capability-acceptance': {
        id: 'capability-acceptance',
        name: 'Capabilities',
        requires: {
          capabilities: [{ capability: 'barcodeScanner' }],
          permissions: EXPO57_CAPABILITY_PERMISSIONS.map((permission) => ({ permission })),
        },
        root: {
          id: 'capability-acceptance-screen',
          type: 'Screen',
          props: { testID: 'capability-acceptance-screen' },
          children: [
            {
              id: 'capability-acceptance-scanner',
              type: 'BarcodeScannerView',
              props: {
                description: 'Generated Expo capability acceptance',
                permissionStatus: 'unknown',
                testID: 'capability-acceptance-scanner',
                title: 'Scan a barcode',
              },
            },
          ],
        },
      },
    },
  };
}
