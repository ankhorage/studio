import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterEach, expect, test } from 'bun:test';

import { assertExpo57GeneratedCapabilityOwnerGraphAsync } from './assertExpo57GeneratedCapabilityOwnerGraphAsync';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

test('accepts newer capability owners within generated and owner-declared ranges', async () => {
  const projectRoot = await createCapabilityGraphAsync({
    '@ankhorage/expo-runtime': '3.0.7',
    '@ankhorage/permissions': '0.2.4',
    '@ankhorage/runtime': '2.2.2',
    '@ankhorage/supabase-auth': '1.2.7',
    '@ankhorage/surface': '3.0.2',
    '@ankhorage/zora': '3.0.2',
  });

  return expect(
    assertExpo57GeneratedCapabilityOwnerGraphAsync(projectRoot),
  ).resolves.toBeUndefined();
});

test('rejects a capability owner below its generated range', async () => {
  const projectRoot = await createCapabilityGraphAsync({
    '@ankhorage/expo-runtime': '3.0.3',
    '@ankhorage/permissions': '0.2.3',
    '@ankhorage/runtime': '2.2.1',
    '@ankhorage/supabase-auth': '1.2.6',
    '@ankhorage/surface': '3.0.1',
    '@ankhorage/zora': '3.0.1',
  });

  return expect(assertExpo57GeneratedCapabilityOwnerGraphAsync(projectRoot)).rejects.toThrow(
    '@ankhorage/expo-runtime resolved 3.0.3, which does not satisfy ^3.0.4',
  );
});

async function createCapabilityGraphAsync(
  installedVersions: Readonly<Record<string, string>>,
): Promise<string> {
  const projectRoot = await mkdtemp(path.join('/tmp', 'ankh-capability-owner-graph-'));
  temporaryDirectories.push(projectRoot);
  const dependencies = {
    '@ankhorage/expo-runtime': '^3.0.4',
    '@ankhorage/permissions': '^0.2.3',
    '@ankhorage/runtime': '^2.2.0',
    '@ankhorage/supabase-auth': '^1.2.5',
    '@ankhorage/zora': '^3.0.0',
  } as const;
  await writeFile(
    path.join(projectRoot, 'package.json'),
    `${JSON.stringify({ dependencies, name: 'capability-owner-graph-test', private: true })}\n`,
  );

  const allVersions = { ...installedVersions, 'react-native': '0.86.3' };
  for (const [packageName, version] of Object.entries(allVersions)) {
    const packageRoot = path.join(projectRoot, 'node_modules', ...packageName.split('/'));
    await mkdir(packageRoot, { recursive: true });
    await writeFile(
      path.join(packageRoot, 'package.json'),
      `${JSON.stringify({
        dependencies:
          packageName === '@ankhorage/zora' ? { '@ankhorage/surface': '^3.0.1' } : undefined,
        name: packageName,
        peerDependencies: packageName.startsWith('@ankhorage/')
          ? { 'react-native': '0.86.x' }
          : undefined,
        version,
      })}\n`,
    );
  }
  await writeFile(
    path.join(projectRoot, 'bun.lock'),
    `${Object.entries(allVersions)
      .map(
        ([packageName, version]) =>
          `${JSON.stringify(packageName)}: [${JSON.stringify(`${packageName}@${version}`)}, "", {}]`,
      )
      .join('\n')}\n`,
  );
  return projectRoot;
}
