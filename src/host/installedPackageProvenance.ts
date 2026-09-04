import { realpath } from 'node:fs/promises';
import path from 'node:path';

export interface InstalledPackageProvenance {
  readonly resolvedCandidatePath: string;
  readonly resolvedWorkspacePath: string;
}

/***
 * Determine whether one already-resolved filesystem path is strictly contained by another.
 * @utility @ankhorage/utility/node/path
 */
export function isPathInsideResolved(
  resolvedParentPath: string,
  resolvedCandidatePath: string,
): boolean {
  const relativePath = path.relative(resolvedParentPath, resolvedCandidatePath);
  return (
    relativePath !== '' &&
    relativePath !== '..' &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath)
  );
}

/***
 * Resolve workspace and candidate paths through the filesystem so provenance checks compare real locations rather than symlink aliases.
 * @utility @ankhorage/utility/node/path
 */
export async function resolveInstalledPackageProvenance(
  workspacePath: string,
  candidatePath: string,
): Promise<InstalledPackageProvenance> {
  const [resolvedWorkspacePath, resolvedCandidatePath] = await Promise.all([
    realpath(workspacePath),
    realpath(candidatePath),
  ]);

  return {
    resolvedCandidatePath,
    resolvedWorkspacePath,
  };
}

/***
 * Check whether a Bun text lockfile contains the exact package/version tuple used by an installed package provenance check.
 * @utility @ankhorage/utility/bun
 */
export function bunLockfileReferencesPackageVersion(
  lockfile: string,
  packageName: string,
  version: string,
): boolean {
  return lockfile.includes(
    `${JSON.stringify(packageName)}: [${JSON.stringify(`${packageName}@${version}`)}`,
  );
}
