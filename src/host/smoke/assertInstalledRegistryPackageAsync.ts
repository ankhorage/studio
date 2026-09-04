import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  bunLockfileReferencesPackageVersion,
  isPathInsideResolved,
  resolveInstalledPackageProvenance,
} from '../installedPackageProvenance';
import { satisfiesCaretSemverRange } from '../orchestrator/semverRange';

/***
 * Assert that a smoke fixture resolves an exact registry package version from its own node_modules and lockfile.
 * @todo Move this acceptance helper out of src/host into test/smoke after its generic provenance primitives move to Utility.
 */
export async function assertInstalledRegistryPackageAsync(options: {
  readonly installationRoot: string;
  readonly lockfile: string;
  readonly packageName: string;
  readonly range: string;
}): Promise<string> {
  const nodeModulesRoot = path.join(options.installationRoot, 'node_modules');
  const packageRoot = path.join(nodeModulesRoot, ...options.packageName.split('/'));
  const provenance = await resolveInstalledPackageProvenance(nodeModulesRoot, packageRoot);
  if (!isPathInsideResolved(provenance.resolvedWorkspacePath, provenance.resolvedCandidatePath)) {
    throw new Error(`${options.packageName} did not resolve from the fixture-owned node_modules.`);
  }

  const packageJson = JSON.parse(
    await readFile(path.join(provenance.resolvedCandidatePath, 'package.json'), 'utf8'),
  ) as { readonly name?: unknown; readonly version?: unknown };
  if (packageJson.name !== options.packageName || typeof packageJson.version !== 'string') {
    throw new Error(`${options.packageName} has invalid installed package metadata.`);
  }
  if (!satisfiesCaretSemverRange(packageJson.version, options.range)) {
    throw new Error(
      `${options.packageName} resolved ${packageJson.version}, which does not satisfy ${options.range}.`,
    );
  }
  if (
    !bunLockfileReferencesPackageVersion(options.lockfile, options.packageName, packageJson.version)
  ) {
    throw new Error(
      `${options.packageName} installation ${packageJson.version} does not match the fixture lockfile.`,
    );
  }

  return packageJson.version;
}
