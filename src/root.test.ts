import { EXPO_PLATFORM } from '@ankhorage/expo-runtime/platform';
import { isRecord, readOwnProperty } from '@ankhorage/utility/object';
import {
  parseSemanticVersion,
  satisfiesCaretSemverRange,
  SEMVER_PATTERNS,
} from '@ankhorage/utility/semver';
import { expect, test } from 'bun:test';

test('keeps the package root independent from every nested app package', async () => {
  const packageJson = (await Bun.file(new URL('../package.json', import.meta.url)).json()) as {
    readonly dependencies?: Readonly<Record<string, string>>;
    readonly overrides?: Readonly<Record<string, string>>;
    readonly peerDependencies?: Readonly<Record<string, string>>;
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
  const prettierIgnore = await Bun.file(new URL('../.prettierignore', import.meta.url)).text();
  expect(prettierIgnore).toContain('/apps/');
  expect(packageJson.peerDependencies?.expo).toBe(EXPO_PLATFORM.runtime.expo.version);
  const reactNativePeerRange = packageJson.peerDependencies?.['react-native'];
  const appReactNativeVersion = appPackageJson.dependencies?.['react-native'];
  expect(reactNativePeerRange).toMatch(SEMVER_PATTERNS.minorWildcard);
  expect(appReactNativeVersion).toMatch(SEMVER_PATTERNS.exact);
  if (typeof reactNativePeerRange === 'string' && typeof appReactNativeVersion === 'string') {
    const version = parseSemanticVersion(appReactNativeVersion);
    expect(version).not.toBeNull();
    expect(reactNativePeerRange).toBe(`${version?.major}.${version?.minor}.x`);
  }
  const contractsRange = packageJson.dependencies?.['@ankhorage/contracts'];
  expect(contractsRange).toMatch(SEMVER_PATTERNS.caret);
  expect(packageJson.overrides?.['@ankhorage/contracts']).toBe('$@ankhorage/contracts');
  const expoRuntimeRange = packageJson.dependencies?.['@ankhorage/expo-runtime'];
  expect(expoRuntimeRange).toMatch(SEMVER_PATTERNS.caret);
  expect(packageJson.dependencies?.['@ankhorage/runtime']).toMatch(SEMVER_PATTERNS.caret);
  expect(packageJson.dependencies?.['@ankhorage/zora']).toMatch(SEMVER_PATTERNS.caret);
  expect(appPackageJson.dependencies?.['@ankhorage/expo-runtime']).toMatch(SEMVER_PATTERNS.caret);
  expect(
    Object.keys(appPackageJson.overrides ?? {}).filter((packageName) =>
      packageName.startsWith('@ankhorage/'),
    ),
  ).toEqual([]);
});

test('keeps standalone synchronization outside the Devtools-managed release workflow', async () => {
  const managedReleaseWorkflow = await Bun.file(
    new URL('../.github/workflows/release.yml', import.meta.url),
  ).text();
  const standaloneSyncWorkflow = await Bun.file(
    new URL('../.github/workflows/studio-self-consumer-sync.yml', import.meta.url),
  ).text();

  expect(managedReleaseWorkflow).not.toContain('Synchronize standalone Studio consumer');
  expect(standaloneSyncWorkflow).toContain('workflow_run:');
  expect(standaloneSyncWorkflow).toContain('workflows:');
  expect(standaloneSyncWorkflow).toContain('- Release');
  expect(standaloneSyncWorkflow).toContain("github.event.workflow_run.conclusion == 'success'");
  expect(standaloneSyncWorkflow).toContain("github.event.workflow_run.head_branch == 'main'");
  expect(standaloneSyncWorkflow).toContain('apps/studio/package.json');
  expect(standaloneSyncWorkflow).toContain('apps/studio/bun.lock');
});

test('keeps the standalone Studio registry dependency consistent with its own lockfile', async () => {
  const appPackageJson = (await Bun.file(
    new URL('../apps/studio/package.json', import.meta.url),
  ).json()) as {
    readonly dependencies?: Readonly<Record<string, string>>;
  };
  const lockValue: unknown = Bun.JSONC.parse(
    await Bun.file(new URL('../apps/studio/bun.lock', import.meta.url)).text(),
  );

  // The root version may be unpublished; the standalone consumer advances after release succeeds.
  const studioRange = appPackageJson.dependencies?.['@ankhorage/studio'];
  expect(studioRange).toMatch(SEMVER_PATTERNS.caret);
  if (typeof studioRange !== 'string') throw new Error('Standalone Studio must declare its owner.');
  expect(lockValue).toMatchObject({
    workspaces: { '': { dependencies: { '@ankhorage/studio': studioRange } } },
  });

  if (!isRecord(lockValue)) throw new Error('Standalone Studio lock must be an object.');
  const packages = readOwnProperty(lockValue, 'packages');
  if (!isRecord(packages)) throw new Error('Standalone Studio lock must contain packages.');
  const studioEntry = readOwnProperty(packages, '@ankhorage/studio');
  const lockedPackage: unknown = Array.isArray(studioEntry) ? studioEntry[0] : undefined;
  if (typeof lockedPackage !== 'string') throw new Error('Standalone Studio must lock its owner.');
  const studioPackagePrefix = '@ankhorage/studio@';
  expect(lockedPackage.startsWith(studioPackagePrefix)).toBe(true);
  const lockedVersion = lockedPackage.slice(studioPackagePrefix.length);
  expect(lockedVersion).toMatch(SEMVER_PATTERNS.exact);
  expect(satisfiesCaretSemverRange(lockedVersion, studioRange)).toBe(true);
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
  expect(permissionsRange).toMatch(SEMVER_PATTERNS.caret);
  expect(studioDependencies.get('@ankhorage/permissions')).toMatch(SEMVER_PATTERNS.caret);
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
