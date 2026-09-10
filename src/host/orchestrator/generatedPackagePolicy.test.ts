import { expect, test } from 'bun:test';

import { getGeneratedPackagePolicy } from './generatedPackagePolicy';
import { getPackageJson } from './templates';

const WEB_TARGETS = { web: { enabled: true } } as const;

test('derives generated dependency ranges from owner package metadata', () => {
  const policy = getGeneratedPackagePolicy();
  const packageJson = getPackageJson({
    name: 'fixture',
    includeStudio: true,
    authProvider: 'supabase',
    storageProvider: 'supabase',
    targets: WEB_TARGETS,
  });

  expect(packageJson.packageManager).toBe(policy.packageManager);
  expect(packageJson.dependencies).toMatchObject({
    '@ankhorage/contracts': policy.dependencies.contracts,
    '@ankhorage/data-sources': policy.dependencies.dataSources,
    '@ankhorage/expo-runtime': policy.dependencies.expoRuntime,
    '@ankhorage/navigator': policy.dependencies.navigator,
    '@ankhorage/runtime': policy.dependencies.runtime,
    '@ankhorage/studio': policy.dependencies.studio,
    '@ankhorage/utility': policy.dependencies.utility,
    '@ankhorage/supabase-auth': policy.dependencies.supabaseAuth,
    '@ankhorage/supabase-storage': policy.dependencies.supabaseStorage,
    '@ankhorage/zora': policy.dependencies.zora,
    '@react-native-picker/picker': policy.peerDependencies.nativePicker,
    '@react-native-vector-icons/fontawesome': policy.peerDependencies.fontawesome,
    '@react-native-vector-icons/fontawesome5': policy.peerDependencies.fontawesome5,
    '@react-native-vector-icons/fontawesome6': policy.peerDependencies.fontawesome6,
    '@react-native-vector-icons/ionicons': policy.peerDependencies.ionicons,
  });
  expect(packageJson.devDependencies).toMatchObject({
    '@ankhorage/ankh': policy.devDependencies.ankh,
    '@ankhorage/devtools': policy.devDependencies.devtools,
    '@types/bun': policy.devDependencies.typesBun,
    '@types/culori': policy.devDependencies.typesCulori,
    '@types/react': policy.devDependencies.typesReact,
  });
});

test('does not introduce optional generated dependencies when their capability is disabled', () => {
  const packageJson = getPackageJson({
    name: 'standalone',
    includeStudio: false,
    targets: WEB_TARGETS,
  });

  expect(packageJson.dependencies['@ankhorage/studio']).toBeUndefined();
  expect(packageJson.dependencies['@ankhorage/utility']).toBeUndefined();
  expect(packageJson.dependencies['@ankhorage/supabase-auth']).toBeUndefined();
  expect(packageJson.dependencies['@ankhorage/supabase-storage']).toBeUndefined();
});
