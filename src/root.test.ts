import { EXPO_PLATFORM } from '@ankhorage/expo-runtime/platform';
import { expect, test } from 'bun:test';

const CARET_SEMVER_RANGE = /^\^\d+\.\d+\.\d+$/u;
const EXACT_SEMVER_VERSION = /^\d+\.\d+\.\d+$/u;
const MINOR_WILDCARD_SEMVER_RANGE = /^\d+\.\d+\.x$/u;

test('exports the Studio runtime symbols used by generated app layouts', async () => {
  const rootSource = await Bun.file(new URL('./root.ts', import.meta.url)).text();

  expect(rootSource).toContain("export { useStudio } from './core/StudioContext.js';");
  expect(rootSource).toContain("export { StudioProvider } from './core/StudioProvider.js';");
  expect(rootSource).toContain("export { AnkhStudio } from './ui/AnkhStudio.js';");
  expect(rootSource).toContain("export { AnkhAdminPage } from './ui/admin/AnkhAdminPage.js';");
  expect(rootSource).toContain("export { AnkhAdminShell } from './ui/admin/AnkhAdminShell.js';");
  expect(rootSource).toContain(
    "export { useStudioAppBarAugmentation } from './ui/useStudioAppBarAugmentation.js';",
  );
});

test('keeps the package root independent from every nested app package', async () => {
  const packageJson = (await Bun.file(new URL('../package.json', import.meta.url)).json()) as {
    readonly dependencies?: Readonly<Record<string, string>>;
    readonly overrides?: Readonly<Record<string, string>>;
    readonly peerDependencies?: Readonly<Record<string, string>>;
    readonly scripts?: Readonly<Record<string, string>>;
    readonly workspaces?: readonly string[];
  };
  const appPackageJson = (await Bun.file(
    new URL('../apps/studio/package.json', import.meta.url),
  ).json()) as {
    readonly dependencies?: Readonly<Record<string, string>>;
    readonly devDependencies?: Readonly<Record<string, string>>;
    readonly overrides?: Readonly<Record<string, string>>;
  };

  expect(packageJson.workspaces).toBeUndefined();
  expect(packageJson.scripts?.test).toBe('bun test src');
  const prettierIgnore = await Bun.file(new URL('../.prettierignore', import.meta.url)).text();
  expect(prettierIgnore).toContain('/apps/');
  expect(packageJson.peerDependencies?.expo).toBe(EXPO_PLATFORM.runtime.expo.version);
  const reactNativePeerRange = packageJson.peerDependencies?.['react-native'];
  const appReactNativeVersion = appPackageJson.dependencies?.['react-native'];
  expect(reactNativePeerRange).toMatch(MINOR_WILDCARD_SEMVER_RANGE);
  expect(appReactNativeVersion).toMatch(EXACT_SEMVER_VERSION);
  if (typeof reactNativePeerRange === 'string' && typeof appReactNativeVersion === 'string') {
    const match = /^(\d+)\.(\d+)\.\d+$/u.exec(appReactNativeVersion);
    expect(match).not.toBeNull();
    expect(reactNativePeerRange).toBe(`${match?.[1]}.${match?.[2]}.x`);
  }
  const contractsRange = packageJson.dependencies?.['@ankhorage/contracts'];
  expect(contractsRange).toMatch(CARET_SEMVER_RANGE);
  expect(packageJson.overrides?.['@ankhorage/contracts']).toBe('$@ankhorage/contracts');
  const expoRuntimeRange = packageJson.dependencies?.['@ankhorage/expo-runtime'];
  expect(expoRuntimeRange).toMatch(CARET_SEMVER_RANGE);
  expect(packageJson.dependencies?.['@ankhorage/runtime']).toMatch(CARET_SEMVER_RANGE);
  expect(packageJson.dependencies?.['@ankhorage/zora']).toMatch(CARET_SEMVER_RANGE);
  expect(appPackageJson.dependencies?.['@ankhorage/expo-runtime']).toMatch(CARET_SEMVER_RANGE);
  expect(
    Object.keys(appPackageJson.overrides ?? {}).filter((packageName) =>
      packageName.startsWith('@ankhorage/'),
    ),
  ).toEqual([]);
});

test('keeps Studio package metadata and the first-party app on the Expo owner contract', async () => {
  const packageJson = (await Bun.file(new URL('../package.json', import.meta.url)).json()) as {
    readonly dependencies?: Readonly<Record<string, string>>;
    readonly devDependencies?: Readonly<Record<string, string>>;
    readonly peerDependencies?: Readonly<Record<string, string>>;
  };
  const appPackageJson = (await Bun.file(
    new URL('../apps/studio/package.json', import.meta.url),
  ).json()) as {
    readonly dependencies?: Readonly<Record<string, string>>;
    readonly devDependencies?: Readonly<Record<string, string>>;
  };

  expectDependencyVersions(packageJson.dependencies, {
    'expo-document-picker': EXPO_PLATFORM.packages.documentPicker.version,
    'expo-file-system': EXPO_PLATFORM.packages.fileSystem.version,
    'expo-image-picker': EXPO_PLATFORM.packages.imagePicker.version,
  });
  expectDependencyVersions(packageJson.peerDependencies, {
    expo: EXPO_PLATFORM.runtime.expo.version,
    'expo-constants': EXPO_PLATFORM.packages.constants.version,
    'expo-router': EXPO_PLATFORM.navigation.expoRouter.version,
    'expo-status-bar': EXPO_PLATFORM.packages.statusBar.version,
    react: EXPO_PLATFORM.runtime.react.version,
    'react-dom': EXPO_PLATFORM.runtime.reactDom.version,
    'react-native-gesture-handler': EXPO_PLATFORM.animation.gestureHandler.version,
    'react-native-reanimated': EXPO_PLATFORM.animation.reanimated.version,
    'react-native-safe-area-context': EXPO_PLATFORM.navigation.safeArea.version,
    'react-native-screens': EXPO_PLATFORM.navigation.screens.version,
    'react-native-web': EXPO_PLATFORM.runtime.reactNativeWeb.version,
    'react-native-worklets': EXPO_PLATFORM.animation.worklets.version,
  });
  expectDependencyVersions(packageJson.devDependencies, {
    '@types/node': EXPO_PLATFORM.tooling.nodeTypes.version,
    '@types/react': EXPO_PLATFORM.tooling.reactTypes.version,
    typescript: EXPO_PLATFORM.tooling.typescript.version,
  });

  expectDependencyVersions(appPackageJson.dependencies, {
    '@expo/metro-runtime': EXPO_PLATFORM.packages.metroRuntime.version,
    expo: EXPO_PLATFORM.runtime.expo.version,
    'expo-constants': EXPO_PLATFORM.packages.constants.version,
    'expo-dev-client': EXPO_PLATFORM.packages.devClient.version,
    'expo-font': EXPO_PLATFORM.packages.font.version,
    'expo-linking': EXPO_PLATFORM.packages.linking.version,
    'expo-router': EXPO_PLATFORM.navigation.expoRouter.version,
    'expo-splash-screen': EXPO_PLATFORM.packages.splashScreen.version,
    'expo-status-bar': EXPO_PLATFORM.packages.statusBar.version,
    react: EXPO_PLATFORM.runtime.react.version,
    'react-dom': EXPO_PLATFORM.runtime.reactDom.version,
    'react-native': EXPO_PLATFORM.runtime.reactNative.version,
    'react-native-gesture-handler': EXPO_PLATFORM.animation.gestureHandler.version,
    'react-native-reanimated': EXPO_PLATFORM.animation.reanimated.version,
    'react-native-safe-area-context': EXPO_PLATFORM.navigation.safeArea.version,
    'react-native-screens': EXPO_PLATFORM.navigation.screens.version,
    'react-native-web': EXPO_PLATFORM.runtime.reactNativeWeb.version,
    'react-native-worklets': EXPO_PLATFORM.animation.worklets.version,
  });
  expectDependencyVersions(appPackageJson.devDependencies, {
    '@types/node': EXPO_PLATFORM.tooling.nodeTypes.version,
    '@types/react': EXPO_PLATFORM.tooling.reactTypes.version,
    'expo-doctor': EXPO_PLATFORM.tooling.expoDoctor.version,
    typescript: EXPO_PLATFORM.tooling.typescript.version,
  });
});

test('supplies the published peers required by consumed Expo Runtime entrypoints', async () => {
  const packageJson = (await Bun.file(new URL('../package.json', import.meta.url)).json()) as {
    readonly dependencies?: Readonly<Record<string, string>>;
  };
  const expoRuntimePackageJson = (await Bun.file(
    new URL('../node_modules/@ankhorage/expo-runtime/package.json', import.meta.url),
  ).json()) as {
    readonly peerDependencies?: Readonly<Record<string, string>>;
  };

  const expoRuntimePeers = new Map(Object.entries(expoRuntimePackageJson.peerDependencies ?? {}));
  const studioDependencies = new Map(Object.entries(packageJson.dependencies ?? {}));

  const permissionsRange = expoRuntimePeers.get('@ankhorage/permissions');
  expect(permissionsRange).toMatch(CARET_SEMVER_RANGE);
  expect(studioDependencies.get('@ankhorage/permissions')).toMatch(CARET_SEMVER_RANGE);
  const imagePickerVersion = EXPO_PLATFORM.packages.imagePicker.version;
  expect(expoRuntimePeers.get('expo-image-picker')).toBe(imagePickerVersion);
  expect(studioDependencies.get('expo-image-picker')).toBe(imagePickerVersion);
});

function expectDependencyVersions(
  actual: Readonly<Record<string, string>> | undefined,
  expected: Readonly<Record<string, string>>,
): void {
  const actualVersions = new Map(Object.entries(actual ?? {}));
  for (const [packageName, expectedVersion] of Object.entries(expected)) {
    expect(actualVersions.get(packageName)).toBe(expectedVersion);
  }
}
