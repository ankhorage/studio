import { lstat, readdir, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

interface InstalledPackageJson {
  readonly name?: string;
  readonly peerDependencies?: Readonly<Record<string, string>>;
  readonly version?: string;
}

export async function assertReactNativeOwnerGraphAsync(options: {
  readonly installationRoot: string;
  readonly reactNativeVersion: string;
  readonly requiredOwnerVersions: Readonly<Record<string, string>>;
}): Promise<void> {
  const nodeModulesRoots = await listNodeModulesRootsAsync(
    path.join(options.installationRoot, 'node_modules'),
  );
  const reactNativeRoots = new Set<string>();
  const ownerPackages = new Map<string, Map<string, InstalledPackageJson>>();

  for (const nodeModulesRoot of nodeModulesRoots) {
    const reactNativeRoot = path.join(nodeModulesRoot, 'react-native');
    if (await pathExistsAsync(path.join(reactNativeRoot, 'package.json'))) {
      reactNativeRoots.add(await realpath(reactNativeRoot));
    }

    const scopeRoot = path.join(nodeModulesRoot, '@ankhorage');
    if (!(await pathExistsAsync(scopeRoot))) continue;
    for (const entry of await readdir(scopeRoot, { withFileTypes: true })) {
      const packageRoot = path.join(scopeRoot, entry.name);
      const packageJsonPath = path.join(packageRoot, 'package.json');
      if (!(await pathExistsAsync(packageJsonPath))) continue;
      const resolvedPackageRoot = await realpath(packageRoot);
      const packageJson = JSON.parse(
        await readFile(packageJsonPath, 'utf8'),
      ) as InstalledPackageJson;
      if (!packageJson.name || !packageJson.version) continue;
      let installedVersions = ownerPackages.get(packageJson.name);
      if (!installedVersions) {
        installedVersions = new Map();
        ownerPackages.set(packageJson.name, installedVersions);
      }
      installedVersions.set(`${packageJson.version}:${resolvedPackageRoot}`, packageJson);
    }
  }

  if (reactNativeRoots.size !== 1) {
    throw new Error(
      `Expected one physical React Native installation, found ${reactNativeRoots.size}: ${[...reactNativeRoots].sort().join(', ') || '<none>'}.`,
    );
  }
  const [reactNativeRoot] = reactNativeRoots;
  if (!reactNativeRoot)
    throw new Error('React Native installation disappeared during graph audit.');
  const reactNativePackage = JSON.parse(
    await readFile(path.join(reactNativeRoot, 'package.json'), 'utf8'),
  ) as InstalledPackageJson;
  if (reactNativePackage.version !== options.reactNativeVersion) {
    throw new Error(
      `Installed React Native is ${String(reactNativePackage.version)} instead of ${options.reactNativeVersion}.`,
    );
  }

  for (const [packageName, packages] of ownerPackages) {
    for (const packageJson of packages.values()) {
      const peerRange = packageJson.peerDependencies?.['react-native'];
      if (peerRange && !Bun.semver.satisfies(options.reactNativeVersion, peerRange)) {
        throw new Error(
          `${packageName}@${String(packageJson.version)} requires incompatible React Native peer ${peerRange}; installed ${options.reactNativeVersion}.`,
        );
      }
    }
  }

  for (const [packageName, expectedVersion] of Object.entries(options.requiredOwnerVersions)) {
    const versions = new Set(
      [...(ownerPackages.get(packageName)?.values() ?? [])]
        .map((packageJson) => packageJson.version)
        .filter((version): version is string => version !== undefined),
    );
    if (!versions.has(expectedVersion)) {
      throw new Error(
        `${packageName} resolved ${[...versions].sort().join(', ') || '<none>'}; expected released owner ${expectedVersion}.`,
      );
    }
  }
}

async function listNodeModulesRootsAsync(initialRoot: string): Promise<string[]> {
  const pending = [initialRoot];
  const roots: string[] = [];
  const visited = new Set<string>();

  while (pending.length > 0) {
    const candidate = pending.pop();
    if (!candidate || !(await pathExistsAsync(candidate))) continue;
    const resolvedRoot = await realpath(candidate);
    if (visited.has(resolvedRoot)) continue;
    visited.add(resolvedRoot);
    roots.push(resolvedRoot);

    for (const entry of await readdir(resolvedRoot, { withFileTypes: true })) {
      if (entry.name === '.bun' && entry.isDirectory()) {
        const storeRoot = path.join(resolvedRoot, entry.name);
        for (const storeEntry of await readdir(storeRoot, { withFileTypes: true })) {
          if (storeEntry.isDirectory()) {
            pending.push(path.join(storeRoot, storeEntry.name, 'node_modules'));
          }
        }
        continue;
      }
      if (entry.name.startsWith('.')) continue;

      const entryRoot = path.join(resolvedRoot, entry.name);
      if (entry.name.startsWith('@')) {
        if (!(await isDirectoryAsync(entryRoot))) continue;
        for (const packageEntry of await readdir(entryRoot, { withFileTypes: true })) {
          if (packageEntry.isDirectory() || packageEntry.isSymbolicLink()) {
            pending.push(path.join(entryRoot, packageEntry.name, 'node_modules'));
          }
        }
      } else if (entry.isDirectory() || entry.isSymbolicLink()) {
        pending.push(path.join(entryRoot, 'node_modules'));
      }
    }
  }

  return roots;
}

async function isDirectoryAsync(target: string): Promise<boolean> {
  return (await lstat(target).catch(() => null))?.isDirectory() ?? false;
}

async function pathExistsAsync(target: string): Promise<boolean> {
  return (await lstat(target).catch(() => null)) !== null;
}
