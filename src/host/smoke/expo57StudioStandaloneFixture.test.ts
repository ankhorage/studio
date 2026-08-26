import { mkdtemp, readFile, rm } from 'node:fs/promises';
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
  const fixtureRoot = await mkdtemp(path.join('/tmp', 'ankh-studio-standalone-test-'));
  temporaryDirectories.push(fixtureRoot);

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
