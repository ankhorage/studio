import { lstat, readdir, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

import { EXPO_PLATFORM } from '@ankhorage/expo-runtime/platform';

import { assertInstalledRegistryPackageAsync } from './assertInstalledRegistryPackageAsync';
import { assertReactNativeOwnerGraphAsync } from './assertReactNativeOwnerGraphAsync';

const FORBIDDEN_DEPENDENCY_PREFIX = /^(?:file|link|workspace):/u;
const EXPO_FONT_RANGE = EXPO_PLATFORM.packages.font.version;
const REQUIRED_ROUTE_EVIDENCE = [
  '/create',
  '/create/[category]',
  '/create/[category]/[slug]',
  '/projects/[projectId]',
] as const;

export async function assertExpo57StudioStandaloneContractAsync(options: {
  readonly fixtureRoot: string;
  readonly installed: boolean;
  readonly repositoryRoot: string;
}): Promise<void> {
  const [fixtureRoot, repositoryRoot] = await Promise.all([
    realpath(options.fixtureRoot),
    realpath(options.repositoryRoot),
  ]);
  if (isWithin(fixtureRoot, repositoryRoot)) {
    throw new Error('Standalone Studio fixture is nested inside the repository checkout.');
  }

  const packageJson = JSON.parse(
    await readFile(path.join(fixtureRoot, 'package.json'), 'utf8'),
  ) as StandalonePackageJson;
  if (packageJson.workspaces !== undefined) {
    throw new Error('Standalone Studio fixture must not declare workspaces.');
  }
  const ownerRanges = await resolveOwnerRangesAsync(repositoryRoot);
  const requiredReleaseRanges = await resolveRequiredReleaseRangesAsync(
    repositoryRoot,
    ownerRanges['@ankhorage/studio'],
  );
  for (const requirement of requiredReleaseRanges) {
    const declaredRange = packageJson[requirement.dependencyGroup]?.[requirement.packageName];
    if (declaredRange !== requirement.range) {
      throw new Error(
        `Standalone Studio fixture declares ${requirement.packageName} ${String(declaredRange)} instead of ${requirement.range}.`,
      );
    }
  }
  if (packageJson.dependencies?.['expo-font'] !== EXPO_FONT_RANGE) {
    throw new Error(
      `Standalone Studio fixture declares expo-font ${String(packageJson.dependencies?.['expo-font'])} instead of ${EXPO_FONT_RANGE}.`,
    );
  }
  assertRegistryDependencyRanges(packageJson);

  const tsconfig = await readFile(path.join(fixtureRoot, 'tsconfig.json'), 'utf8');
  if (tsconfig.includes('../../') || tsconfig.includes('dist/root.d.ts')) {
    throw new Error('Standalone Studio TypeScript configuration reaches into parent output.');
  }
  await assertCopiedFilesAreIndependentAsync(fixtureRoot, repositoryRoot);
  if (options.installed) {
    await assertInstalledContractAsync(
      fixtureRoot,
      packageJson,
      requiredReleaseRanges,
      ownerRanges,
    );
  }
}

async function assertCopiedFilesAreIndependentAsync(
  fixtureRoot: string,
  repositoryRoot: string,
): Promise<void> {
  const files = await listFilesAsync(fixtureRoot);
  for (const file of files) {
    const relativePath = path.relative(fixtureRoot, file);
    const fileStat = await lstat(file);
    if (fileStat.isSymbolicLink()) {
      throw new Error(`Standalone Studio fixture contains symlink ${relativePath}.`);
    }
    if (!fileStat.isFile()) continue;
    const source = await readFile(file, 'utf8');
    if (source.includes(repositoryRoot)) {
      throw new Error(`Standalone Studio fixture file ${relativePath} reaches the checkout.`);
    }
  }
}

async function assertInstalledContractAsync(
  fixtureRoot: string,
  packageJson: StandalonePackageJson,
  requiredReleaseRanges: readonly ReleaseRequirement[],
  ownerRanges: Readonly<
    Record<'@ankhorage/runtime' | '@ankhorage/studio' | '@ankhorage/surface', string>
  >,
): Promise<void> {
  const lockfile = await readFile(path.join(fixtureRoot, 'bun.lock'), 'utf8');
  for (const requirement of requiredReleaseRanges) {
    const declaredRange = packageJson[requirement.dependencyGroup]?.[requirement.packageName];
    if (declaredRange === undefined) {
      throw new Error(`Standalone Studio fixture does not declare ${requirement.packageName}.`);
    }
    await assertInstalledRegistryPackageAsync({
      installationRoot: fixtureRoot,
      lockfile,
      packageName: requirement.packageName,
      range: declaredRange,
    });
  }

  await assertReactNativeOwnerGraphAsync({
    installationRoot: fixtureRoot,
    reactNativeVersion: requireDependencyRange(packageJson, 'dependencies', 'react-native'),
    requiredOwnerRanges: {
      ...ownerRanges,
      ...(await resolveInstalledStudioOwnerRangesAsync(fixtureRoot)),
      '@ankhorage/expo-runtime': requireDependencyRange(
        packageJson,
        'dependencies',
        '@ankhorage/expo-runtime',
      ),
    },
  });

  const routerTypesPath = path.join(fixtureRoot, '.expo', 'types', 'router.d.ts');
  const routerTypesStat = await stat(routerTypesPath).catch(() => null);
  if (routerTypesStat !== null) {
    if (!routerTypesStat.isFile() || routerTypesStat.size === 0) {
      throw new Error('Standalone Studio Router declarations are empty.');
    }
    const routerTypes = await readFile(routerTypesPath, 'utf8');
    for (const route of REQUIRED_ROUTE_EVIDENCE) {
      if (!routerTypes.includes(route)) {
        throw new Error(`Standalone Studio Router declarations are missing ${route}.`);
      }
    }
  }
}

/*** Reads the ZORA range owned by the installed registry Studio package. */
async function resolveInstalledStudioOwnerRangesAsync(
  fixtureRoot: string,
): Promise<Readonly<Record<'@ankhorage/zora', string>>> {
  const packageJson = JSON.parse(
    await readFile(
      path.join(fixtureRoot, 'node_modules', '@ankhorage', 'studio', 'package.json'),
      'utf8',
    ),
  ) as StandalonePackageJson;
  const zoraRange = packageJson.dependencies?.['@ankhorage/zora'];
  if (zoraRange === undefined) {
    throw new Error('Installed @ankhorage/studio does not declare @ankhorage/zora.');
  }
  return { '@ankhorage/zora': zoraRange };
}

function assertRegistryDependencyRanges(packageJson: StandalonePackageJson): void {
  for (const [name, version] of Object.entries({
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  })) {
    if (version === 'latest' || FORBIDDEN_DEPENDENCY_PREFIX.test(version)) {
      throw new Error(`Standalone Studio dependency ${name} uses forbidden range ${version}.`);
    }
  }
  for (const [name, script] of Object.entries(packageJson.scripts ?? {})) {
    if (script.includes('../..')) {
      throw new Error(`Standalone Studio script ${name} reaches outside its package root.`);
    }
  }
}

function isWithin(target: string, parent: string): boolean {
  const relativePath = path.relative(parent, target);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

async function listFilesAsync(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      files.push(...(await listFilesAsync(target)));
    } else files.push(target);
  }
  return files;
}

async function resolveRequiredReleaseRangesAsync(
  repositoryRoot: string,
  studioRange: string,
): Promise<readonly ReleaseRequirement[]> {
  const studioPackageJson = await readPackageJsonAsync(
    path.join(repositoryRoot, 'apps', 'studio', 'package.json'),
  );
  const devtoolsRange = studioPackageJson.devDependencies?.['@ankhorage/devtools'];
  if (devtoolsRange === undefined) {
    throw new Error('Studio app does not declare @ankhorage/devtools.');
  }

  const expoRuntimeRange = studioPackageJson.dependencies?.['@ankhorage/expo-runtime'];
  if (expoRuntimeRange === undefined) {
    throw new Error('Studio app does not declare @ankhorage/expo-runtime.');
  }

  return [
    {
      dependencyGroup: 'dependencies',
      packageName: '@ankhorage/studio',
      range: studioRange,
    },
    {
      dependencyGroup: 'dependencies',
      packageName: '@ankhorage/expo-runtime',
      range: expoRuntimeRange,
    },
    {
      dependencyGroup: 'devDependencies',
      packageName: '@ankhorage/devtools',
      range: devtoolsRange,
    },
  ];
}

async function resolveOwnerRangesAsync(
  repositoryRoot: string,
): Promise<
  Readonly<Record<'@ankhorage/runtime' | '@ankhorage/studio' | '@ankhorage/surface', string>>
> {
  const [repositoryPackageJson, studioPackageJson, zoraPackageJson] = await Promise.all([
    readPackageJsonAsync(path.join(repositoryRoot, 'package.json')),
    readPackageJsonAsync(path.join(repositoryRoot, 'apps', 'studio', 'package.json')),
    readPackageJsonAsync(
      path.join(repositoryRoot, 'node_modules', '@ankhorage', 'zora', 'package.json'),
    ),
  ]);
  return {
    '@ankhorage/runtime': requireDependencyRange(
      repositoryPackageJson,
      'dependencies',
      '@ankhorage/runtime',
    ),
    '@ankhorage/studio': requireDependencyRange(
      studioPackageJson,
      'dependencies',
      '@ankhorage/studio',
    ),
    '@ankhorage/surface': requireDependencyRange(
      zoraPackageJson,
      'dependencies',
      '@ankhorage/surface',
    ),
  };
}

/*** Reads a JSON package manifest from disk. */
async function readPackageJsonAsync(filePath: string): Promise<StandalonePackageJson> {
  return JSON.parse(await readFile(filePath, 'utf8')) as StandalonePackageJson;
}

function requireDependencyRange(
  packageJson: StandalonePackageJson,
  dependencyGroup: ReleaseRequirement['dependencyGroup'],
  packageName: string,
): string {
  const dependencies =
    dependencyGroup === 'dependencies' ? packageJson.dependencies : packageJson.devDependencies;
  const range = new Map(Object.entries(dependencies ?? {})).get(packageName);
  if (range === undefined) {
    throw new Error(`Standalone Studio fixture does not declare ${packageName}.`);
  }
  return range;
}

interface ReleaseRequirement {
  readonly dependencyGroup: 'dependencies' | 'devDependencies';
  readonly packageName: string;
  readonly range: string;
}

interface StandalonePackageJson {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly scripts?: Readonly<Record<string, string>>;
  readonly workspaces?: unknown;
}
