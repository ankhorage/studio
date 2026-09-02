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

test('keeps the package root and first-party apps in Studio workspace installs', async () => {
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
  };

  expect(packageJson.workspaces).toEqual(['.', 'apps/*']);
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
  expect(packageJson.dependencies?.['@ankhorage/contracts']).toMatch(CARET_SEMVER_RANGE);
  expect(packageJson.overrides?.['@ankhorage/contracts']).toBe('$@ankhorage/contracts');
  const expoRuntimeRange = packageJson.dependencies?.['@ankhorage/expo-runtime'];
  expect(expoRuntimeRange).toMatch(CARET_SEMVER_RANGE);
  expect(packageJson.dependencies?.['@ankhorage/runtime']).toMatch(CARET_SEMVER_RANGE);
  expect(packageJson.dependencies?.['@ankhorage/zora']).toMatch(CARET_SEMVER_RANGE);
  expect(appPackageJson.dependencies?.expo).toBe(EXPO_PLATFORM.runtime.expo.version);
  expect(appPackageJson.dependencies?.['@ankhorage/expo-runtime']).toMatch(CARET_SEMVER_RANGE);
  expect(appPackageJson.dependencies?.['expo-font']).toBe(EXPO_PLATFORM.packages.font.version);
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
