import { compareSemanticVersions, parseSemanticVersion } from '@ankhorage/utility/semver';

import type {
  GeneratedPackageManifest,
  GeneratedPackagePolicy,
} from '../../../types/project-updates.js';
import { readManagedPackageRangeFloor } from './readManagedPackageRangeFloor.js';

const OBSOLETE_GENERATED_DEPENDENCIES = new Set([
  '@react-native-picker/picker',
  '@ankhorage/zora-chess',
  '@ankhorage/zora-game',
  '@ankhorage/zora-tabletop',
]);

/*** Apply one explicit Studio package policy while preserving user-owned package manifest entries outside superseded Studio-managed dependencies. */
export function applyGeneratedPackagePolicy<T extends GeneratedPackageManifest>(
  packageJson: T,
  policy: GeneratedPackagePolicy,
): T {
  const baseDependencies = Object.fromEntries(
    Object.entries(packageJson.dependencies).filter(
      ([name]) => !OBSOLETE_GENERATED_DEPENDENCIES.has(name),
    ),
  );
  const dependencies = {
    ...baseDependencies,
    '@ankhorage/contracts': monotonicAnkhorageRange(packageJson.dependencies['@ankhorage/contracts'], policy.dependencies.contracts),
    '@ankhorage/data-sources': monotonicAnkhorageRange(packageJson.dependencies['@ankhorage/data-sources'], policy.dependencies.dataSources),
    '@ankhorage/expo-runtime': monotonicAnkhorageRange(packageJson.dependencies['@ankhorage/expo-runtime'], policy.dependencies.expoRuntime),
    '@ankhorage/navigator': monotonicAnkhorageRange(packageJson.dependencies['@ankhorage/navigator'], policy.dependencies.navigator),
    '@ankhorage/runtime': monotonicAnkhorageRange(packageJson.dependencies['@ankhorage/runtime'], policy.dependencies.runtime),
    ...('@ankhorage/studio' in packageJson.dependencies
      ? { '@ankhorage/studio': monotonicAnkhorageRange(packageJson.dependencies['@ankhorage/studio'], policy.dependencies.studio) }
      : {}),
    ...('@ankhorage/utility' in packageJson.dependencies
      ? { '@ankhorage/utility': monotonicAnkhorageRange(packageJson.dependencies['@ankhorage/utility'], policy.dependencies.utility) }
      : {}),
    ...('@ankhorage/supabase-auth' in packageJson.dependencies
      ? { '@ankhorage/supabase-auth': monotonicAnkhorageRange(packageJson.dependencies['@ankhorage/supabase-auth'], policy.dependencies.supabaseAuth) }
      : {}),
    ...('@ankhorage/supabase-storage' in packageJson.dependencies
      ? { '@ankhorage/supabase-storage': monotonicAnkhorageRange(packageJson.dependencies['@ankhorage/supabase-storage'], policy.dependencies.supabaseStorage) }
      : {}),
    '@ankhorage/zora': monotonicAnkhorageRange(packageJson.dependencies['@ankhorage/zora'], policy.dependencies.zora),
    '@react-native-vector-icons/fontawesome': policy.peerDependencies.fontawesome,
    '@react-native-vector-icons/fontawesome5': policy.peerDependencies.fontawesome5,
    '@react-native-vector-icons/fontawesome6': policy.peerDependencies.fontawesome6,
    '@react-native-vector-icons/ionicons': policy.peerDependencies.ionicons,
  };
  const devDependencies = {
    ...packageJson.devDependencies,
    '@ankhorage/ankh': monotonicAnkhorageRange(packageJson.devDependencies['@ankhorage/ankh'], policy.devDependencies.ankh),
    '@ankhorage/devtools': monotonicAnkhorageRange(packageJson.devDependencies['@ankhorage/devtools'], policy.devDependencies.devtools),
    '@types/bun': policy.devDependencies.typesBun,
    '@types/culori': policy.devDependencies.typesCulori,
    '@types/react': policy.devDependencies.typesReact,
  };

  return Object.assign({}, packageJson, {
    packageManager: policy.packageManager,
    dependencies,
    devDependencies,
  });
}


/*** Preserve an already-higher Ankhorage dependency floor while still allowing Studio policy to raise stale floors. */
function monotonicAnkhorageRange(currentRange: string | undefined, policyRange: string): string {
  if (currentRange === undefined) return policyRange;
  const currentFloor = readManagedPackageRangeFloor(currentRange);
  const policyFloor = readManagedPackageRangeFloor(policyRange);
  if (currentFloor === undefined || policyFloor === undefined) return policyRange;
  const current = parseSemanticVersion(currentFloor);
  const policy = parseSemanticVersion(policyFloor);
  if (current === null || policy === null) return policyRange;
  return compareSemanticVersions(current, policy) >= 0 ? currentRange : policyRange;
}
