import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'bun:test';

import { assertInstalledRegistryPackageAsync } from './assertInstalledRegistryPackageAsync';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((temporaryRoot) => rm(temporaryRoot, { force: true, recursive: true })),
  );
});

describe('assertInstalledRegistryPackageAsync', () => {
  it('accepts a newer compatible patch when installation, range, lockfile, and root agree', async () => {
    const installationRoot = await createInstallationRootAsync();
    await writeInstalledPackageAsync(installationRoot, '@ankhorage/studio', '2.0.8');

    expect(
      await assertInstalledRegistryPackageAsync({
        installationRoot,
        lockfile: createLockfileEntry('@ankhorage/studio', '2.0.8'),
        packageName: '@ankhorage/studio',
        range: '^2.0.7',
      }),
    ).toBe('2.0.8');
  });

  it('rejects an installed version outside the declared range', async () => {
    const installationRoot = await createInstallationRootAsync();
    await writeInstalledPackageAsync(installationRoot, '@ankhorage/studio', '3.0.0');

    expect(
      assertInstalledRegistryPackageAsync({
        installationRoot,
        lockfile: createLockfileEntry('@ankhorage/studio', '3.0.0'),
        packageName: '@ankhorage/studio',
        range: '^2.0.7',
      }),
    ).rejects.toThrow('does not satisfy ^2.0.7');
  });

  it('rejects a lockfile version that disagrees with the installed package', async () => {
    const installationRoot = await createInstallationRootAsync();
    await writeInstalledPackageAsync(installationRoot, '@ankhorage/studio', '2.0.8');

    expect(
      assertInstalledRegistryPackageAsync({
        installationRoot,
        lockfile: createLockfileEntry('@ankhorage/studio', '2.0.7'),
        packageName: '@ankhorage/studio',
        range: '^2.0.7',
      }),
    ).rejects.toThrow('does not match the fixture lockfile');
  });

  it('rejects a package symlink that resolves outside the installation root', async () => {
    const installationRoot = await createInstallationRootAsync();
    const externalPackageRoot = await mkdtemp(
      path.join(tmpdir(), 'studio-registry-package-external-'),
    );
    temporaryRoots.push(externalPackageRoot);
    await writeFile(
      path.join(externalPackageRoot, 'package.json'),
      `${JSON.stringify({ name: '@ankhorage/studio', version: '2.0.8' })}\n`,
    );
    const installedPackageRoot = resolvePackageRoot(installationRoot, '@ankhorage/studio');
    await mkdir(path.dirname(installedPackageRoot), { recursive: true });
    await symlink(externalPackageRoot, installedPackageRoot);

    expect(
      assertInstalledRegistryPackageAsync({
        installationRoot,
        lockfile: createLockfileEntry('@ankhorage/studio', '2.0.8'),
        packageName: '@ankhorage/studio',
        range: '^2.0.7',
      }),
    ).rejects.toThrow('fixture-owned node_modules');
  });

  it('rejects a package symlink that stays inside the fixture but escapes node_modules', async () => {
    const installationRoot = await createInstallationRootAsync();
    const localPackageRoot = path.join(installationRoot, 'local-source', 'studio');
    await mkdir(localPackageRoot, { recursive: true });
    await writeFile(
      path.join(localPackageRoot, 'package.json'),
      `${JSON.stringify({ name: '@ankhorage/studio', version: '2.0.8' })}\n`,
    );
    const installedPackageRoot = resolvePackageRoot(installationRoot, '@ankhorage/studio');
    await mkdir(path.dirname(installedPackageRoot), { recursive: true });
    await symlink(localPackageRoot, installedPackageRoot);

    expect(
      assertInstalledRegistryPackageAsync({
        installationRoot,
        lockfile: createLockfileEntry('@ankhorage/studio', '2.0.8'),
        packageName: '@ankhorage/studio',
        range: '^2.0.7',
      }),
    ).rejects.toThrow('fixture-owned node_modules');
  });
});

async function createInstallationRootAsync(): Promise<string> {
  const installationRoot = await mkdtemp(path.join(tmpdir(), 'studio-registry-installation-'));
  temporaryRoots.push(installationRoot);
  return installationRoot;
}

function createLockfileEntry(packageName: string, version: string): string {
  return `${JSON.stringify(packageName)}: [${JSON.stringify(`${packageName}@${version}`)}, "", {}]\n`;
}

function resolvePackageRoot(installationRoot: string, packageName: string): string {
  return path.join(installationRoot, 'node_modules', ...packageName.split('/'));
}

async function writeInstalledPackageAsync(
  installationRoot: string,
  packageName: string,
  version: string,
): Promise<void> {
  const packageRoot = resolvePackageRoot(installationRoot, packageName);
  await mkdir(packageRoot, { recursive: true });
  await writeFile(
    path.join(packageRoot, 'package.json'),
    `${JSON.stringify({ name: packageName, version })}\n`,
  );
}
