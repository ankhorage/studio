import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterEach, expect, test } from 'bun:test';

import { assertExpo57StudioStandaloneContractAsync } from './assertExpo57StudioStandaloneContractAsync';
import { createExpo57StudioStandaloneFixtureAsync } from './createExpo57StudioStandaloneFixtureAsync';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

test('copies apps/studio directly into an independent single-package root', async () => {
  const repositoryRoot = process.cwd();
  const fixtureRoot = await createFixtureRootAsync();

  await createExpo57StudioStandaloneFixtureAsync({ fixtureRoot, repositoryRoot });
  await assertExpo57StudioStandaloneContractAsync({
    fixtureRoot,
    installed: false,
    repositoryRoot,
  });

  const packageJson = JSON.parse(
    await readFile(path.join(fixtureRoot, 'package.json'), 'utf8'),
  ) as { readonly dependencies?: Record<string, string>; readonly workspaces?: unknown };
  expect(packageJson.workspaces).toBeUndefined();
  expect(packageJson.dependencies?.['@ankhorage/studio']).toBe('^2.0.9');
});

test('accepts newer compatible registry patches installed and locked inside the fixture', async () => {
  const repositoryRoot = process.cwd();
  const fixtureRoot = await createFixtureRootAsync();
  await createExpo57StudioStandaloneFixtureAsync({ fixtureRoot, repositoryRoot });

  const installedVersions = {
    '@ankhorage/devtools': '1.7.1',
    '@ankhorage/expo-runtime': '3.0.10',
    '@ankhorage/runtime': '2.2.2',
    '@ankhorage/studio': '2.0.10',
    '@ankhorage/surface': '3.0.2',
    '@ankhorage/zora': '3.0.2',
    'expo-font': '57.0.1',
    'react-native': '0.86.3',
  } as const;
  await writeInstalledGraphAsync(fixtureRoot, installedVersions);

  await assertExpo57StudioStandaloneContractAsync({
    fixtureRoot,
    installed: true,
    repositoryRoot,
  });
});

test('rejects a registry package below the declared fixture range', async () => {
  const repositoryRoot = process.cwd();
  const fixtureRoot = await createFixtureRootAsync();
  await createExpo57StudioStandaloneFixtureAsync({ fixtureRoot, repositoryRoot });
  await writeInstalledGraphAsync(fixtureRoot, {
    '@ankhorage/devtools': '1.7.0',
    '@ankhorage/expo-runtime': '3.0.10',
    '@ankhorage/runtime': '2.2.1',
    '@ankhorage/studio': '2.0.8',
    '@ankhorage/surface': '3.0.1',
    '@ankhorage/zora': '3.0.1',
    'expo-font': '57.0.1',
    'react-native': '0.86.3',
  });

  return expect(
    assertExpo57StudioStandaloneContractAsync({
      fixtureRoot,
      installed: true,
      repositoryRoot,
    }),
  ).rejects.toThrow('@ankhorage/studio resolved 2.0.8, which does not satisfy ^2.0.9');
});

async function createFixtureRootAsync(): Promise<string> {
  const fixtureRoot = await mkdtemp(path.join('/tmp', 'ankh-studio-standalone-test-'));
  temporaryDirectories.push(fixtureRoot);
  return fixtureRoot;
}

async function writeInstalledPackageAsync(
  fixtureRoot: string,
  packageName: string,
  version: string,
): Promise<void> {
  const packageRoot = path.join(fixtureRoot, 'node_modules', ...packageName.split('/'));
  await mkdir(packageRoot, { recursive: true });
  await writeFile(
    path.join(packageRoot, 'package.json'),
    `${JSON.stringify({
      name: packageName,
      ...(packageName.startsWith('@ankhorage/') && packageName !== '@ankhorage/devtools'
        ? { peerDependencies: { 'react-native': '0.86.x' } }
        : {}),
      version,
    })}\n`,
  );
}

async function writeInstalledGraphAsync(
  fixtureRoot: string,
  installedVersions: Readonly<Record<string, string>>,
): Promise<void> {
  for (const [packageName, version] of Object.entries(installedVersions)) {
    await writeInstalledPackageAsync(fixtureRoot, packageName, version);
  }
  await writeFile(
    path.join(fixtureRoot, 'bun.lock'),
    `${Object.entries(installedVersions)
      .map(
        ([packageName, version]) =>
          `${JSON.stringify(packageName)}: [${JSON.stringify(`${packageName}@${version}`)}, "", {}]`,
      )
      .join('\n')}\n`,
  );
}
