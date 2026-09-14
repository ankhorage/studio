import type { GeneratedPackageManifest } from '../../../types/project-updates';
import { getGeneratedPackagePolicy } from '../adapters/outbound/getGeneratedPackagePolicy';
import { applyGeneratedPackagePolicy } from '../domain/applyGeneratedPackagePolicy';

/*** Apply package policy owned by this exact installed Studio artifact. */
export function applyCurrentGeneratedPackagePolicy<T extends GeneratedPackageManifest>(
  packageJson: T,
): T {
  return applyGeneratedPackagePolicy(packageJson, getGeneratedPackagePolicy());
}
