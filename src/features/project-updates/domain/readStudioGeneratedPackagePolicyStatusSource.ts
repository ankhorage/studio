import type { ApmStatusDependency } from '@ankhorage/apm/types';

import type { StudioGeneratedPackagePolicySource } from '../../../types/project-updates';
import { STUDIO_PACKAGE_NAME } from '../constants';

/*** Resolve the unique direct Studio package identity from evaluated APM status evidence. */
export function readStudioGeneratedPackagePolicyStatusSource(
  dependencies: readonly ApmStatusDependency[],
): StudioGeneratedPackagePolicySource | undefined {
  const candidates = dependencies.filter(
    (dependency) =>
      dependency.direct &&
      dependency.name === STUDIO_PACKAGE_NAME &&
      dependency.declaration !== undefined,
  );
  const [dependency] = candidates;
  const version = dependency?.lockedVersion ?? dependency?.installed.version;
  return candidates.length === 1 && dependency?.declaration !== undefined && version !== undefined
    ? {
        packageId: dependency.packageId,
        installRootId: dependency.installRootId,
        ownerPath: dependency.declaration.ownerPath,
        version,
      }
    : undefined;
}
