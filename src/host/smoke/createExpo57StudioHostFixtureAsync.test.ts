import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';

import { afterEach, expect, test } from 'bun:test';

import { getPackageJson } from '../orchestrator/templates';
import { createExpo57StudioHostFixtureAsync } from './createExpo57StudioHostFixtureAsync';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

test('gives the host project the generated app-owned reconciliation tools', async () => {
  const workspaceRoot = await mkdtemp(path.join('/tmp', 'ankh-studio-host-fixture-test-'));
  temporaryDirectories.push(workspaceRoot);

  await createExpo57StudioHostFixtureAsync(workspaceRoot, 'developer_tools');

  const projectPackage = JSON.parse(
    await readFile(path.join(workspaceRoot, 'apps', 'release-monitor', 'package.json'), 'utf8'),
  ) as { readonly devDependencies: Readonly<Record<string, string>> };
  const generatedPackage = getPackageJson({ name: 'release-monitor', targets: {} });

  expect(projectPackage.devDependencies).toEqual({
    '@ankhorage/ankh': generatedPackage.devDependencies['@ankhorage/ankh'],
    '@ankhorage/devtools': generatedPackage.devDependencies['@ankhorage/devtools'],
  });
});
