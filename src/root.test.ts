import { expect, test } from 'bun:test';

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
  expect(packageJson.peerDependencies?.expo).toBe('57.0.17');
  expect(packageJson.peerDependencies?.['react-native']).toBe('0.86.x');
  expect(packageJson.dependencies?.['@ankhorage/expo-runtime']).toBe('^3.0.10');
  expect(packageJson.dependencies?.['@ankhorage/runtime']).toBe('^2.2.1');
  expect(packageJson.dependencies?.['@ankhorage/zora']).toBe('^3.0.1');
  expect(appPackageJson.dependencies?.expo).toBe('57.0.17');
  expect(appPackageJson.dependencies?.['react-native']).toBe('0.86.3');
  expect(appPackageJson.dependencies?.['@ankhorage/expo-runtime']).toBe('^3.0.10');
  expect(appPackageJson.dependencies?.['expo-font']).toBe('~57.0.1');
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

  const expectedStudioOwnedPeers = {
    '@ankhorage/permissions': '^0.2.3',
    'expo-image-picker': '~57.0.12',
  } as const;
  const expoRuntimePeers = new Map(Object.entries(expoRuntimePackageJson.peerDependencies ?? {}));
  const studioDependencies = new Map(Object.entries(packageJson.dependencies ?? {}));

  for (const [packageName, expectedRange] of Object.entries(expectedStudioOwnedPeers)) {
    expect(expoRuntimePeers.get(packageName)).toBe(expectedRange);
    expect(studioDependencies.get(packageName)).toBe(expectedRange);
  }
});
