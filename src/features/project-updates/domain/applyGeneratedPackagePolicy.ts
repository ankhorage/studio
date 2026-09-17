import type {
  GeneratedPackageManifest,
  GeneratedPackagePolicy,
} from '../../../types/project-updates.js';

const OBSOLETE_GENERATED_DEPENDENCIES = new Set(['@react-native-picker/picker']);

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
  const zoraExtensionDependencies = Object.fromEntries(
    Object.entries(policy.dependencies.zoraExtensions).filter(([packageName]) =>
      Object.hasOwn(packageJson.dependencies, packageName),
    ),
  );
  const dependencies = {
    ...baseDependencies,
    '@ankhorage/contracts': policy.dependencies.contracts,
    '@ankhorage/data-sources': policy.dependencies.dataSources,
    '@ankhorage/expo-runtime': policy.dependencies.expoRuntime,
    '@ankhorage/navigator': policy.dependencies.navigator,
    '@ankhorage/runtime': policy.dependencies.runtime,
    ...('@ankhorage/studio' in packageJson.dependencies
      ? { '@ankhorage/studio': policy.dependencies.studio }
      : {}),
    ...('@ankhorage/utility' in packageJson.dependencies
      ? { '@ankhorage/utility': policy.dependencies.utility }
      : {}),
    ...('@ankhorage/supabase-auth' in packageJson.dependencies
      ? { '@ankhorage/supabase-auth': policy.dependencies.supabaseAuth }
      : {}),
    ...('@ankhorage/supabase-storage' in packageJson.dependencies
      ? { '@ankhorage/supabase-storage': policy.dependencies.supabaseStorage }
      : {}),
    '@ankhorage/zora': policy.dependencies.zora,
    ...zoraExtensionDependencies,
    '@react-native-vector-icons/fontawesome': policy.peerDependencies.fontawesome,
    '@react-native-vector-icons/fontawesome5': policy.peerDependencies.fontawesome5,
    '@react-native-vector-icons/fontawesome6': policy.peerDependencies.fontawesome6,
    '@react-native-vector-icons/ionicons': policy.peerDependencies.ionicons,
  };
  const devDependencies = {
    ...packageJson.devDependencies,
    '@ankhorage/ankh': policy.devDependencies.ankh,
    '@ankhorage/devtools': policy.devDependencies.devtools,
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
