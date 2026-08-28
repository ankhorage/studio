import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterEach, expect, test } from 'bun:test';

import { assertReactNativeOwnerGraphAsync } from './assertReactNativeOwnerGraphAsync';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

test('accepts newer owner patches within their declared ranges', async () => {
  const root = await createGraphAsync();
  await writePackageAsync(root, '@ankhorage/runtime', '2.2.2', '0.86.x');
  await writePackageAsync(root, '@ankhorage/studio', '2.0.10', '0.86.x');

  return expect(
    assertReactNativeOwnerGraphAsync({
      installationRoot: root,
      reactNativeVersion: '0.86.3',
      requiredOwnerRanges: {
        '@ankhorage/runtime': '^2.2.1',
        '@ankhorage/studio': '^2.0.9',
      },
    }),
  ).resolves.toBeUndefined();
});

test('rejects an installed owner below its declared range', async () => {
  const root = await createGraphAsync();

  return expect(
    assertReactNativeOwnerGraphAsync({
      installationRoot: root,
      reactNativeVersion: '0.86.3',
      requiredOwnerRanges: { '@ankhorage/studio': '^2.0.10' },
    }),
  ).rejects.toThrow(
    '@ankhorage/studio resolved 2.0.9; expected a released owner satisfying ^2.0.10',
  );
});

test('rejects an incompatible installed Ankhorage RN peer', async () => {
  const root = await createGraphAsync();
  await writePackageAsync(root, '@ankhorage/runtime', '2.2.0', '0.86.2');

  return expect(
    assertReactNativeOwnerGraphAsync({
      installationRoot: root,
      reactNativeVersion: '0.86.3',
      requiredOwnerRanges: {},
    }),
  ).rejects.toThrow('requires incompatible React Native peer 0.86.2');
});

test('rejects multiple physical RN installations', async () => {
  const root = await createGraphAsync();
  const nestedRoot = path.join(root, 'node_modules', '.bun', 'nested', 'node_modules');
  await writePackageJsonAsync(path.join(nestedRoot, 'react-native'), {
    name: 'react-native',
    version: '0.86.3',
  });

  return expect(
    assertReactNativeOwnerGraphAsync({
      installationRoot: root,
      reactNativeVersion: '0.86.3',
      requiredOwnerRanges: {},
    }),
  ).rejects.toThrow('Expected one physical React Native installation, found 2');
});

async function createGraphAsync(): Promise<string> {
  const root = await mkdtemp(path.join('/tmp', 'ankh-rn-owner-graph-'));
  temporaryDirectories.push(root);
  await writePackageJsonAsync(path.join(root, 'node_modules', 'react-native'), {
    name: 'react-native',
    version: '0.86.3',
  });
  await writePackageAsync(root, '@ankhorage/runtime', '2.2.1', '0.86.x');
  await writePackageAsync(root, '@ankhorage/studio', '2.0.9', '0.86.x');
  return root;
}

async function writePackageAsync(
  root: string,
  name: string,
  version: string,
  reactNativePeer: string,
): Promise<void> {
  const packageRoot = path.join(root, 'node_modules', ...name.split('/'));
  await writePackageJsonAsync(packageRoot, {
    name,
    peerDependencies: { 'react-native': reactNativePeer },
    version,
  });
}

async function writePackageJsonAsync(
  packageRoot: string,
  packageJson: Readonly<Record<string, unknown>>,
): Promise<void> {
  await mkdir(packageRoot, { recursive: true });
  await writeFile(path.join(packageRoot, 'package.json'), `${JSON.stringify(packageJson)}\n`);
}
