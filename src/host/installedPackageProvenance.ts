import { realpath } from 'node:fs/promises';
import path from 'node:path';

export interface InstalledPackageProvenance {
  readonly resolvedCandidatePath: string;
  readonly resolvedWorkspacePath: string;
}

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

export function bunLockfileReferencesPackageVersion(
  lockfile: string,
  packageName: string,
  version: string,
): boolean {
  return lockfile.includes(
    `${JSON.stringify(packageName)}: [${JSON.stringify(`${packageName}@${version}`)}`,
  );
}
