import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterEach, describe, expect, test } from 'bun:test';

import { resolveAppOwnedExpoCliAsync } from './resolveAppOwnedExpoCliAsync';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  );
});

describe('resolveAppOwnedExpoCliAsync', () => {
  test('returns only the Expo CLI installed in the app package', async () => {
    const projectRoot = await createProjectRootAsync();
    const expoCli = path.join(projectRoot, 'node_modules', '.bin', 'expo');
    await mkdir(path.dirname(expoCli), { recursive: true });
    await writeFile(expoCli, '#!/bin/sh\n', 'utf8');

    expect(resolveAppOwnedExpoCliAsync(projectRoot)).resolves.toBe(expoCli);
  });

  test('fails precisely when the app-owned Expo CLI is absent', async () => {
    const projectRoot = await createProjectRootAsync();
    const expoCli = path.join(projectRoot, 'node_modules', '.bin', 'expo');

    expect(resolveAppOwnedExpoCliAsync(projectRoot)).rejects.toThrow(
      `App-owned Expo CLI is missing: ${expoCli}\n` +
        `Run 'bun install --frozen-lockfile' in ${projectRoot} before running Expo acceptance.`,
    );
  });
});

async function createProjectRootAsync(): Promise<string> {
  const projectRoot = await mkdtemp(path.join('/tmp', 'ankh-app-owned-expo-'));
  temporaryRoots.push(projectRoot);
  return projectRoot;
}
