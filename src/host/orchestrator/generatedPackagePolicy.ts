import { readFileSync } from 'node:fs';

import { isRecord, readOwnProperty } from '@ankhorage/utility/object';

/*** Return generated-app dependency ranges from Studio's Renovate-managed package metadata. */
export function getGeneratedPackagePolicy(): GeneratedPackagePolicy {
  return GENERATED_PACKAGE_POLICY;
}

const GENERATED_PACKAGE_POLICY = readGeneratedPackagePolicy();
const STUDIO_PACKAGE_JSON_URL = new URL('../../../package.json', import.meta.url);
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u;
const BUN_PACKAGE_MANAGER_PATTERN = /^bun@\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u;

interface GeneratedPackagePolicy {
  readonly packageManager: string;
  readonly dependencies: {
    readonly contracts: string;
    readonly dataSources: string;
    readonly expoRuntime: string;
    readonly navigator: string;
    readonly runtime: string;
    readonly studio: string;
    readonly utility: string;
    readonly supabaseAuth: string;
    readonly supabaseStorage: string;
    readonly zora: string;
  };
  readonly devDependencies: {
    readonly ankh: string;
    readonly devtools: string;
    readonly typesBun: string;
    readonly typesCulori: string;
    readonly typesReact: string;
  };
  readonly peerDependencies: {
    readonly nativePicker: string;
    readonly fontawesome: string;
    readonly fontawesome5: string;
    readonly fontawesome6: string;
    readonly ionicons: string;
  };
}

/*** Read and validate the Studio package metadata that owns generated-app dependency floors. */
function readGeneratedPackagePolicy(): GeneratedPackagePolicy {
  const manifest: unknown = JSON.parse(readFileSync(STUDIO_PACKAGE_JSON_URL, 'utf8'));
  if (!isRecord(manifest)) throw new Error('Studio package.json must contain an object.');

  const dependencies = readRequiredSection(manifest, 'dependencies');
  const devDependencies = readRequiredSection(manifest, 'devDependencies');
  const peerDependencies = readRequiredSection(manifest, 'peerDependencies');
  const version = readRequiredString(manifest, 'version');
  const packageManager = readRequiredString(manifest, 'packageManager');
  if (!SEMVER_PATTERN.test(version)) throw new Error('Studio package.json version must be exact semver.');
  if (!BUN_PACKAGE_MANAGER_PATTERN.test(packageManager)) {
    throw new Error('Studio package.json packageManager must pin an exact Bun version.');
  }

  return {
    packageManager,
    dependencies: {
      contracts: readRequiredString(dependencies, '@ankhorage/contracts'),
      dataSources: readRequiredString(dependencies, '@ankhorage/data-sources'),
      expoRuntime: readRequiredString(dependencies, '@ankhorage/expo-runtime'),
      navigator: readRequiredString(dependencies, '@ankhorage/navigator'),
      runtime: readRequiredString(dependencies, '@ankhorage/runtime'),
      studio: `^${version}`,
      utility: readRequiredString(dependencies, '@ankhorage/utility'),
      supabaseAuth: readRequiredString(dependencies, '@ankhorage/supabase-auth'),
      supabaseStorage: readRequiredString(dependencies, '@ankhorage/supabase-storage'),
      zora: readRequiredString(dependencies, '@ankhorage/zora'),
    },
    devDependencies: {
      ankh: readRequiredString(devDependencies, '@ankhorage/ankh'),
      devtools: readRequiredString(devDependencies, '@ankhorage/devtools'),
      typesBun: readRequiredString(devDependencies, '@types/bun'),
      typesCulori: readRequiredString(devDependencies, '@types/culori'),
      typesReact: readRequiredString(devDependencies, '@types/react'),
    },
    peerDependencies: {
      nativePicker: readRequiredString(peerDependencies, '@react-native-picker/picker'),
      fontawesome: readRequiredString(peerDependencies, '@react-native-vector-icons/fontawesome'),
      fontawesome5: readRequiredString(peerDependencies, '@react-native-vector-icons/fontawesome5'),
      fontawesome6: readRequiredString(peerDependencies, '@react-native-vector-icons/fontawesome6'),
      ionicons: readRequiredString(peerDependencies, '@react-native-vector-icons/ionicons'),
    },
  };
}

/*** Read one required package-manifest dependency section. */
function readRequiredSection(
  manifest: Readonly<Record<string, unknown>>,
  sectionName: string,
): Readonly<Record<string, unknown>> {
  const section = readOwnProperty(manifest, sectionName);
  if (!isRecord(section)) throw new Error(`Studio package.json ${sectionName} must be an object.`);
  return section;
}

/*** Read one required non-empty string property from package metadata. */
function readRequiredString(record: Readonly<Record<string, unknown>>, key: string): string {
  const value = readOwnProperty(record, key);
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Studio package metadata must define ${key} as a non-empty string.`);
  }
  return value;
}
