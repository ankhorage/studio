import { lstat, readdir, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

import { assertInstalledRegistryPackageAsync } from './assertInstalledRegistryPackageAsync';

const FORBIDDEN_DEPENDENCY_PREFIX = /^(?:file|link|workspace):/u;
const REQUIRED_ROUTE_EVIDENCE = [
  '/create',
  '/create/[category]',
  '/create/[category]/[templateId]',
  '/projects/[projectId]',
] as const;
const REQUIRED_RELEASE_RANGES = [
  {
    dependencyGroup: 'dependencies',
    packageName: '@ankhorage/studio',
    range: '^2.0.7',
  },
  {
    dependencyGroup: 'devDependencies',
    packageName: '@ankhorage/expo-runtime',
    range: '^3.0.5',
  },
  {
    dependencyGroup: 'devDependencies',
    packageName: '@ankhorage/devtools',
    range: '^1.6.1',
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
  for (const requirement of REQUIRED_RELEASE_RANGES) {
    const declaredRange = packageJson[requirement.dependencyGroup]?.[requirement.packageName];
    if (declaredRange !== requirement.range) {
      throw new Error(
        `Standalone Studio fixture declares ${requirement.packageName} ${String(declaredRange)} instead of ${requirement.range}.`,
      );
    }
  }
  assertRegistryDependencyRanges(packageJson);

  const tsconfig = await readFile(path.join(fixtureRoot, 'tsconfig.json'), 'utf8');
  if (tsconfig.includes('../../') || tsconfig.includes('dist/root.d.ts')) {
    throw new Error('Standalone Studio TypeScript configuration reaches into parent output.');
  }
  await assertCopiedFilesAreIndependentAsync(fixtureRoot, repositoryRoot);
  if (options.installed) await assertInstalledContractAsync(fixtureRoot, packageJson);
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
): Promise<void> {
  const lockfile = await readFile(path.join(fixtureRoot, 'bun.lock'), 'utf8');
  for (const requirement of REQUIRED_RELEASE_RANGES) {
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

interface StandalonePackageJson {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly scripts?: Readonly<Record<string, string>>;
  readonly workspaces?: unknown;
}
