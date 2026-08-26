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
  expect(packageJson.dependencies?.['@ankhorage/studio']).toBe('^2.0.7');
});

test('accepts newer compatible registry patches installed and locked inside the fixture', async () => {
  const repositoryRoot = process.cwd();
  const fixtureRoot = await createFixtureRootAsync();
  await createExpo57StudioStandaloneFixtureAsync({ fixtureRoot, repositoryRoot });

  const installedVersions = {
    '@ankhorage/devtools': '1.6.2',
    '@ankhorage/expo-runtime': '3.0.6',
    '@ankhorage/studio': '2.0.8',
  } as const;
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

  await assertExpo57StudioStandaloneContractAsync({
    fixtureRoot,
    installed: true,
    repositoryRoot,
  });
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
    `${JSON.stringify({ name: packageName, version })}\n`,
  );
}
