import { lstat, readdir, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

import { EXPO_PLATFORM } from '@ankhorage/expo-runtime/platform';

import { assertInstalledRegistryPackageAsync } from './assertInstalledRegistryPackageAsync';
import { assertReactNativeOwnerGraphAsync } from './assertReactNativeOwnerGraphAsync';

const FORBIDDEN_DEPENDENCY_PREFIX = /^(?:file|link|workspace):/u;
const EXPO_FONT_RANGE = EXPO_PLATFORM.packages.font.version;
const REQUIRED_OWNER_RANGES = {
  '@ankhorage/runtime': '^2.2.1',
  '@ankhorage/studio': '^2.0.9',
  '@ankhorage/surface': '^3.0.1',
  '@ankhorage/zora': '^4.0.0',
} as const;
const REQUIRED_ROUTE_EVIDENCE = [
  '/create',
  '/create/[category]',
  '/create/[category]/[templateId]',
  '/projects/[projectId]',
] as const;
const REQUIRED_RELEASE_RANGES: readonly ReleaseRequirement[] = [
  {
    dependencyGroup: 'dependencies',
    packageName: '@ankhorage/studio',
    range: REQUIRED_OWNER_RANGES['@ankhorage/studio'],
  },
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
  const requiredReleaseRanges = await resolveRequiredReleaseRangesAsync(repositoryRoot);
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
    await assertInstalledContractAsync(fixtureRoot, packageJson, requiredReleaseRanges);
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
    reactNativeVersion: '0.86.3',
    requiredOwnerRanges: {
      ...REQUIRED_OWNER_RANGES,
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
): Promise<readonly ReleaseRequirement[]> {
  const repositoryPackageJson = JSON.parse(
    await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'),
  ) as StandalonePackageJson;
  const devtoolsRange = repositoryPackageJson.devDependencies?.['@ankhorage/devtools'];
  if (devtoolsRange === undefined) {
    throw new Error('Studio repository root does not declare @ankhorage/devtools.');
  }

  const expoRuntimeRange = repositoryPackageJson.dependencies?.['@ankhorage/expo-runtime'];
  if (expoRuntimeRange === undefined) {
    throw new Error('Studio repository root does not declare @ankhorage/expo-runtime.');
  }

  return [
    ...REQUIRED_RELEASE_RANGES,
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
