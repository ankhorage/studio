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
  expect(packageJson.dependencies?.['@ankhorage/expo-runtime']).toBe('^3.0.6');
  expect(packageJson.dependencies?.['@ankhorage/runtime']).toBe('^2.2.1');
  expect(packageJson.dependencies?.['@ankhorage/zora']).toBe('^3.0.1');
  expect(appPackageJson.dependencies?.expo).toBe('57.0.17');
  expect(appPackageJson.dependencies?.['react-native']).toBe('0.86.3');
  expect(appPackageJson.devDependencies?.['@ankhorage/expo-runtime']).toBe('^3.0.6');
});

test('supplies the published peer required by Expo Runtime planning', async () => {
  const packageJson = (await Bun.file(new URL('../package.json', import.meta.url)).json()) as {
    readonly dependencies?: Readonly<Record<string, string>>;
  };
  const expoRuntimePackageJson = (await Bun.file(
    new URL('../node_modules/@ankhorage/expo-runtime/package.json', import.meta.url),
  ).json()) as {
    readonly peerDependencies?: Readonly<Record<string, string>>;
  };

  const requiredPermissionsRange =
    expoRuntimePackageJson.peerDependencies?.['@ankhorage/permissions'];
  expect(requiredPermissionsRange).toBe('^0.2.3');
  expect(packageJson.dependencies?.['@ankhorage/permissions']).toBe(requiredPermissionsRange);
});
