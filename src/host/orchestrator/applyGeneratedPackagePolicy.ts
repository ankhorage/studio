import { getGeneratedPackagePolicy } from './generatedPackagePolicy';

/*** Apply owner-managed package ranges to one generated app package manifest. */
export function applyGeneratedPackagePolicy<T extends GeneratedPackageManifest>(packageJson: T): T {
  const policy = getGeneratedPackagePolicy();
  const dependencies = {
    ...packageJson.dependencies,
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
    '@react-native-picker/picker': policy.peerDependencies.nativePicker,
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

interface GeneratedPackageManifest {
  readonly packageManager: string;
  readonly dependencies: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
}
