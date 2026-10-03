import type { ApmDependencyInventory } from '@ankhorage/apm/types';

import type { StudioGeneratedPackagePolicySource } from '../../../types/project-updates';
import { STUDIO_PACKAGE_NAME } from '../constants';

/*** Resolve the unique direct Studio package identity from manager-native inventory evidence. */
export function readStudioGeneratedPackagePolicyInventorySource(
  inventory: ApmDependencyInventory,
): StudioGeneratedPackagePolicySource | undefined {
  const candidates = inventory.roots.flatMap((root) =>
    root.declarations.flatMap((declaration) => {
      if (
        declaration.name !== STUDIO_PACKAGE_NAME ||
        declaration.resolvedPackageId === undefined
      ) {
        return [];
      }
      const locked = root.lockedPackages.find(
        (pkg) => pkg.id === declaration.resolvedPackageId,
      );
      return locked?.version === undefined
        ? []
        : [
            {
              packageId: `${root.id}::${locked.id}`,
              installRootId: root.id,
              ownerPath: declaration.ownerPath,
              version: locked.version,
            },
          ];
    }),
  );
  return candidates.length === 1 ? candidates[0] : undefined;
}
