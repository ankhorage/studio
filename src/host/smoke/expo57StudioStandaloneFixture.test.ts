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
  const sourcePackageJson = await readPackageJsonAsync(
    path.join(repositoryRoot, 'apps', 'studio', 'package.json'),
  );
  expect(packageJson.workspaces).toBeUndefined();
  expect(packageJson.dependencies?.['@ankhorage/studio']).toBe(
    requireDependencyRange(sourcePackageJson.dependencies, '@ankhorage/studio'),
  );
});

test('accepts newer compatible registry patches installed and locked inside the fixture', async () => {
  const repositoryRoot = process.cwd();
  const fixtureRoot = await createFixtureRootAsync();
  await createExpo57StudioStandaloneFixtureAsync({ fixtureRoot, repositoryRoot });

  const installedVersions = await createCompatibleInstalledVersionsAsync(repositoryRoot);
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
  const fixturePackageJson = await readPackageJsonAsync(path.join(fixtureRoot, 'package.json'));
  const studioRange = requireDependencyRange(fixturePackageJson.dependencies, '@ankhorage/studio');
  const incompatibleStudioVersion = createVersionBelowRange(studioRange);
  await writeInstalledGraphAsync(fixtureRoot, {
    ...(await createCompatibleInstalledVersionsAsync(repositoryRoot)),
    '@ankhorage/studio': incompatibleStudioVersion,
  });

  return expect(
    assertExpo57StudioStandaloneContractAsync({
      fixtureRoot,
      installed: true,
      repositoryRoot,
    }),
  ).rejects.toThrow(
    `@ankhorage/studio resolved ${incompatibleStudioVersion}, which does not satisfy ${studioRange}`,
  );
});

test('requires ZORA to satisfy the range declared by installed registry Studio', async () => {
  const repositoryRoot = process.cwd();
  const fixtureRoot = await createFixtureRootAsync();
  await createExpo57StudioStandaloneFixtureAsync({ fixtureRoot, repositoryRoot });
  await writeInstalledGraphAsync(fixtureRoot, {
    ...(await createCompatibleInstalledVersionsAsync(repositoryRoot)),
    '@ankhorage/zora': '3.3.4',
  });

  return expect(
    assertExpo57StudioStandaloneContractAsync({
      fixtureRoot,
      installed: true,
      repositoryRoot,
    }),
  ).rejects.toThrow('@ankhorage/zora resolved 3.3.4; expected a released owner satisfying ^4.0.0.');
});

test('requires the standalone app to use the repository-selected Devtools range', async () => {
  const repositoryRoot = process.cwd();
  const fixtureRoot = await createFixtureRootAsync();
  await createExpo57StudioStandaloneFixtureAsync({ fixtureRoot, repositoryRoot });

  const fixturePackagePath = path.join(fixtureRoot, 'package.json');
  const fixturePackageJson = JSON.parse(await readFile(fixturePackagePath, 'utf8')) as {
    readonly devDependencies: Record<string, string>;
  };
  fixturePackageJson.devDependencies['@ankhorage/devtools'] = '^0.0.1';
  await writeFile(fixturePackagePath, `${JSON.stringify(fixturePackageJson, null, 2)}\n`);

  const repositoryPackageJson = JSON.parse(
    await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'),
  ) as { readonly devDependencies: Record<string, string> };
  const expectedRange = repositoryPackageJson.devDependencies['@ankhorage/devtools'];

  return expect(
    assertExpo57StudioStandaloneContractAsync({
      fixtureRoot,
      installed: false,
      repositoryRoot,
    }),
  ).rejects.toThrow(
    `Standalone Studio fixture declares @ankhorage/devtools ^0.0.1 instead of ${expectedRange}.`,
  );
});

test('requires the standalone app to use the repository-selected Expo Runtime range', async () => {
  const repositoryRoot = process.cwd();
  const fixtureRoot = await createFixtureRootAsync();
  await createExpo57StudioStandaloneFixtureAsync({ fixtureRoot, repositoryRoot });

  const fixturePackagePath = path.join(fixtureRoot, 'package.json');
  const fixturePackageJson = JSON.parse(await readFile(fixturePackagePath, 'utf8')) as {
    readonly dependencies: Record<string, string>;
  };
  fixturePackageJson.dependencies['@ankhorage/expo-runtime'] = '^0.0.1';
  await writeFile(fixturePackagePath, `${JSON.stringify(fixturePackageJson, null, 2)}\n`);

  const repositoryPackageJson = JSON.parse(
    await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'),
  ) as { readonly dependencies: Record<string, string> };
  const expectedRange = repositoryPackageJson.dependencies['@ankhorage/expo-runtime'];

  return expect(
    assertExpo57StudioStandaloneContractAsync({
      fixtureRoot,
      installed: false,
      repositoryRoot,
    }),
  ).rejects.toThrow(
    `Standalone Studio fixture declares @ankhorage/expo-runtime ^0.0.1 instead of ${expectedRange}.`,
  );
});

async function createFixtureRootAsync(): Promise<string> {
  const fixtureRoot = await mkdtemp(path.join('/tmp', 'ankh-studio-standalone-test-'));
  temporaryDirectories.push(fixtureRoot);
  return fixtureRoot;
}

async function createCompatibleInstalledVersionsAsync(
  repositoryRoot: string,
): Promise<Readonly<Record<string, string>>> {
  const [repositoryPackageJson, studioPackageJson, zoraPackageJson] = await Promise.all([
    readPackageJsonAsync(path.join(repositoryRoot, 'package.json')),
    readPackageJsonAsync(path.join(repositoryRoot, 'apps', 'studio', 'package.json')),
    readPackageJsonAsync(
      path.join(repositoryRoot, 'node_modules', '@ankhorage', 'zora', 'package.json'),
    ),
  ]);
  return {
    '@ankhorage/devtools': createCompatibleVersion(
      requireDependencyRange(repositoryPackageJson.devDependencies, '@ankhorage/devtools'),
    ),
    '@ankhorage/expo-runtime': createCompatibleVersion(
      requireDependencyRange(repositoryPackageJson.dependencies, '@ankhorage/expo-runtime'),
    ),
    '@ankhorage/runtime': createCompatibleVersion(
      requireDependencyRange(repositoryPackageJson.dependencies, '@ankhorage/runtime'),
    ),
    '@ankhorage/studio': createCompatibleVersion(
      requireDependencyRange(studioPackageJson.dependencies, '@ankhorage/studio'),
    ),
    '@ankhorage/surface': createCompatibleVersion(
      requireDependencyRange(zoraPackageJson.dependencies, '@ankhorage/surface'),
    ),
    '@ankhorage/zora': createCompatibleVersion(
      requireDependencyRange(repositoryPackageJson.dependencies, '@ankhorage/zora'),
    ),
    'expo-font': createCompatibleVersion(
      requireDependencyRange(studioPackageJson.dependencies, 'expo-font'),
    ),
    'react-native': createCompatibleVersion(
      requireDependencyRange(studioPackageJson.dependencies, 'react-native'),
    ),
  };
}

function createCompatibleVersion(range: string): string {
  const version = parseSemverRange(range);
  if (version.patch === 'x') return `${version.major}.${version.minor}.1`;
  if (version.operator === '') return `${version.major}.${version.minor}.${version.patch}`;
  return `${version.major}.${version.minor}.${Number(version.patch) + 1}`;
}

function createVersionBelowRange(range: string): string {
  const version = parseSemverRange(range);
  if (version.patch === 'x' || version.operator === '') {
    throw new Error(`Cannot create an incompatible lower version for ${range}.`);
  }
  const patch = Number(version.patch);
  if (patch > 0) return `${version.major}.${version.minor}.${patch - 1}`;
  if (version.minor > 0) return `${version.major}.${version.minor - 1}.0`;
  throw new Error(`Cannot create an incompatible lower version for ${range}.`);
}

function parseSemverRange(range: string): ParsedSemverRange {
  const match = /^(?<operator>\^|~)?(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+|x)$/u.exec(range);
  if (match?.groups === undefined) throw new Error(`Unsupported test semver range: ${range}.`);
  const { major, minor, operator = '', patch } = match.groups;
  if (
    major === undefined ||
    minor === undefined ||
    patch === undefined ||
    (operator !== '' && operator !== '^' && operator !== '~')
  ) {
    throw new Error(`Unsupported test semver range: ${range}.`);
  }
  return {
    major: Number(major),
    minor: Number(minor),
    operator,
    patch,
  };
}

async function readPackageJsonAsync(packagePath: string): Promise<PackageJsonShape> {
  return JSON.parse(await readFile(packagePath, 'utf8')) as PackageJsonShape;
}

function requireDependencyRange(
  dependencies: Readonly<Record<string, string>> | undefined,
  packageName: string,
): string {
  const range = new Map(Object.entries(dependencies ?? {})).get(packageName);
  if (range === undefined) throw new Error(`Missing test dependency ${packageName}.`);
  return range;
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
      ...(packageName === '@ankhorage/studio'
        ? { dependencies: { '@ankhorage/zora': '^4.0.0' } }
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

interface PackageJsonShape {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
}

interface ParsedSemverRange {
  readonly major: number;
  readonly minor: number;
  readonly operator: '' | '^' | '~';
  readonly patch: string;
}
