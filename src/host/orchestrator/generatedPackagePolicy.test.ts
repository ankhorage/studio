import { parseSemanticVersion } from '@ankhorage/utility/semver';
import { expect, test } from 'bun:test';

import { getGeneratedPackagePolicy } from '../../features/project-updates/adapters/outbound/getGeneratedPackagePolicy';
import { applyGeneratedPackagePolicy } from '../../features/project-updates/domain/applyGeneratedPackagePolicy';
import { getPackageJson } from './templates';

const WEB_TARGETS = { web: { enabled: true } } as const;

test('derives generated dependency ranges from owner package metadata', async () => {
  const policy = getGeneratedPackagePolicy();
  const studioPackage = (await Bun.file(
    new URL('../../../package.json', import.meta.url),
  ).json()) as {
    readonly dependencies?: Readonly<Record<string, string>>;
  };
  const selfConsumerPackage = (await Bun.file(
    new URL('../../../apps/studio/package.json', import.meta.url),
  ).json()) as {
    readonly dependencies?: Readonly<Record<string, string>>;
  };
  const packageJson = getPackageJson({
    name: 'fixture',
    includeStudio: true,
    authProvider: 'supabase',
    storageProvider: 'supabase',
    targets: WEB_TARGETS,
  });
  const generatedDependencies = packageJson.dependencies as Record<string, string>;

  const selfConsumerStudioRange = selfConsumerPackage.dependencies?.['@ankhorage/studio'];
  if (!selfConsumerStudioRange) {
    throw new Error('Studio self-consumer is missing its published Studio dependency range.');
  }

  expect(packageJson.packageManager).toBe(policy.packageManager);
  expect(policy.dependencies.studio).toBe(selfConsumerStudioRange);
  expect(packageJson.dependencies).toMatchObject({
    '@ankhorage/contracts': policy.dependencies.contracts,
    '@ankhorage/data-sources': policy.dependencies.dataSources,
    '@ankhorage/expo-runtime': policy.dependencies.expoRuntime,
    '@ankhorage/navigator': policy.dependencies.navigator,
    '@ankhorage/runtime': policy.dependencies.runtime,
    '@ankhorage/surface': policy.dependencies.surface,
    '@ankhorage/studio': policy.dependencies.studio,
    '@ankhorage/utility': policy.dependencies.utility,
    '@ankhorage/supabase-auth': policy.dependencies.supabaseAuth,
    '@ankhorage/storage-supabase': policy.dependencies.storageSupabase,
    '@ankhorage/zora': policy.dependencies.zora,
    '@react-native-vector-icons/fontawesome': policy.peerDependencies.fontawesome,
    '@react-native-vector-icons/fontawesome5': policy.peerDependencies.fontawesome5,
    '@react-native-vector-icons/fontawesome6': policy.peerDependencies.fontawesome6,
    '@react-native-vector-icons/ionicons': policy.peerDependencies.ionicons,
  });
  expect(
    Object.keys(studioPackage.dependencies ?? {}).filter((packageName) =>
      packageName.startsWith('@ankhorage/zora-'),
    ),
  ).toEqual([]);
  expect(Object.hasOwn(packageJson.dependencies, '@react-native-picker/picker')).toBe(false);
  expect(packageJson.devDependencies).toMatchObject({
    '@ankhorage/ankh': policy.devDependencies.ankh,
    '@ankhorage/devtools': policy.devDependencies.devtools,
    '@types/bun': policy.devDependencies.typesBun,
    '@types/culori': policy.devDependencies.typesCulori,
    '@types/react': policy.devDependencies.typesReact,
  });
  expect(selfConsumerPackage.dependencies['@ankhorage/navigator']).toBeUndefined();
  expect(selfConsumerPackage.dependencies['@ankhorage/surface']).toBeUndefined();
  expect(generatedDependencies['@ankhorage/navigator']).toBe(policy.dependencies.navigator);
  expect(generatedDependencies['@ankhorage/surface']).toBe(policy.dependencies.surface);
});

test('does not introduce optional generated dependencies when their capability is disabled', () => {
  const packageJson = getPackageJson({
    name: 'standalone',
    includeStudio: false,
    targets: WEB_TARGETS,
  });

  expect(packageJson.dependencies['@ankhorage/studio']).toBeUndefined();
  expect(packageJson.dependencies['@ankhorage/utility']).toBeDefined();
  expect(packageJson.dependencies['@ankhorage/supabase-auth']).toBeUndefined();
  expect(packageJson.dependencies['@ankhorage/storage-supabase']).toBeUndefined();
  expect(Object.hasOwn(packageJson.dependencies, '@react-native-picker/picker')).toBe(false);
});

test('never lowers already-newer Ankhorage dependency floors', () => {
  const policy = getGeneratedPackagePolicy();
  const basePackageJson = getPackageJson({
    name: 'fixture',
    includeStudio: true,
    authProvider: 'supabase',
    storageProvider: 'supabase',
    targets: WEB_TARGETS,
  });
  const newerContracts = nextMinorCaretRange(policy.dependencies.contracts);
  const newerAnkh = nextMinorCaretRange(policy.devDependencies.ankh);
  const newerDevtools = nextMinorCaretRange(policy.devDependencies.devtools);

  const updated = applyGeneratedPackagePolicy(
    {
      ...basePackageJson,
      dependencies: {
        ...basePackageJson.dependencies,
        '@ankhorage/contracts': newerContracts,
      },
      devDependencies: {
        ...basePackageJson.devDependencies,
        '@ankhorage/ankh': newerAnkh,
        '@ankhorage/devtools': newerDevtools,
      },
    },
    policy,
  );

  expect(updated.dependencies['@ankhorage/contracts']).toBe(newerContracts);
  expect(updated.devDependencies['@ankhorage/ankh']).toBe(newerAnkh);
  expect(updated.devDependencies['@ankhorage/devtools']).toBe(newerDevtools);

  const raised = applyGeneratedPackagePolicy(
    {
      ...basePackageJson,
      dependencies: {
        ...basePackageJson.dependencies,
        '@ankhorage/contracts': '^0.0.1',
      },
      devDependencies: {
        ...basePackageJson.devDependencies,
        '@ankhorage/ankh': '^0.0.1',
        '@ankhorage/devtools': '^0.0.1',
      },
    },
    policy,
  );
  expect(raised.dependencies['@ankhorage/contracts']).toBe(policy.dependencies.contracts);
  expect(raised.devDependencies['@ankhorage/ankh']).toBe(policy.devDependencies.ankh);
  expect(raised.devDependencies['@ankhorage/devtools']).toBe(policy.devDependencies.devtools);
});

/*** Create a caret range whose semantic-version floor is newer than the supplied managed range. */
function nextMinorCaretRange(range: string): string {
  const exact = range.startsWith('^') || range.startsWith('~') ? range.slice(1) : range;
  const parsed = parseSemanticVersion(exact);
  if (parsed === null) throw new Error(`Expected managed semver range, received ${range}.`);
  return `^${parsed.major}.${parsed.minor + 1}.0`;
}
