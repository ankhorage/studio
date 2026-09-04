import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { readOwnProperty } from '../../utils/readOwnProperty';
import { assertInstalledRegistryPackageAsync } from './assertInstalledRegistryPackageAsync';
import { assertReactNativeOwnerGraphAsync } from './assertReactNativeOwnerGraphAsync';

/***
 * Assert released package ownership, React Native graph consistency, and forbidden legacy Expo packages for a capability fixture.
 * @todo Move this capability-graph acceptance policy out of src/host into test/smoke.
 */
export async function assertExpo57GeneratedCapabilityOwnerGraphAsync(
  projectRoot: string,
): Promise<void> {
  const projectPackage = await readPackageJsonAsync(path.join(projectRoot, 'package.json'));
  const lockfile = await readFile(path.join(projectRoot, 'bun.lock'), 'utf8');
  const requiredDirectOwners = [
    '@ankhorage/expo-runtime',
    '@ankhorage/permissions',
    '@ankhorage/supabase-auth',
  ] as const;
  for (const packageName of requiredDirectOwners) {
    const range = requireDependencyRange(projectPackage, packageName);
    await assertInstalledRegistryPackageAsync({
      installationRoot: projectRoot,
      lockfile,
      packageName,
      range,
    });
  }

  const zoraPackage = await readPackageJsonAsync(
    path.join(projectRoot, 'node_modules', '@ankhorage', 'zora', 'package.json'),
  );

  await assertReactNativeOwnerGraphAsync({
    installationRoot: projectRoot,
    reactNativeVersion: '0.86.3',
    requiredOwnerRanges: {
      '@ankhorage/expo-runtime': requireDependencyRange(projectPackage, '@ankhorage/expo-runtime'),
      '@ankhorage/runtime': requireDependencyRange(projectPackage, '@ankhorage/runtime'),
      '@ankhorage/surface': requireDependencyRange(zoraPackage, '@ankhorage/surface'),
      '@ankhorage/zora': requireDependencyRange(projectPackage, '@ankhorage/zora'),
    },
  });

  for (const forbiddenPackage of ['expo-av', 'expo-permissions']) {
    if (lockfile.includes(`"${forbiddenPackage}@`)) {
      throw new Error(`Generated capability graph contains ${forbiddenPackage}.`);
    }
  }
}

/***
 * Read and parse a package.json file from disk.
 * @utility @ankhorage/utility/node/package
 */
async function readPackageJsonAsync(packageJsonPath: string): Promise<PackageJson> {
  return JSON.parse(await readFile(packageJsonPath, 'utf8')) as PackageJson;
}

/***
 * Require a string dependency range for one package name from a package manifest.
 * @utility @ankhorage/utility/node/package
 */
function requireDependencyRange(packageJson: PackageJson, packageName: string): string {
  const range = packageJson.dependencies
    ? readOwnProperty<string>(packageJson.dependencies, packageName)
    : undefined;
  if (typeof range !== 'string') {
    throw new Error(`Capability fixture does not declare ${packageName}.`);
  }
  return range;
}

interface PackageJson {
  readonly dependencies?: Readonly<Record<string, string>>;
}
