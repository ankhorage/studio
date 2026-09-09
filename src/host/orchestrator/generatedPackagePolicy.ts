import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { isRecord, readOwnProperty } from '@ankhorage/utility/object';

/*** Return generated-app dependency ranges from Renovate-managed owner package metadata. */
export function getGeneratedPackagePolicy(): GeneratedPackagePolicy {
  return GENERATED_PACKAGE_POLICY;
}

const REQUIRE = createRequire(import.meta.url);
const STUDIO_PACKAGE_JSON_URL = new URL('../../../package.json', import.meta.url);
const COLOR_THEORY_PACKAGE_JSON_PATH = REQUIRE.resolve('@ankhorage/color-theory/package.json');
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u;
const BUN_PACKAGE_MANAGER_PATTERN = /^bun@\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u;
const GENERATED_PACKAGE_POLICY = readGeneratedPackagePolicy();

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

/*** Read and validate owner package metadata used as generated-app dependency floors. */
function readGeneratedPackagePolicy(): GeneratedPackagePolicy {
  const studio = readPackageManifest(STUDIO_PACKAGE_JSON_URL, 'Studio');
  const colorTheory = readPackageManifest(COLOR_THEORY_PACKAGE_JSON_PATH, 'Color Theory');
  const dependencies = readRequiredSection(studio, 'dependencies', 'Studio');
  const devDependencies = readRequiredSection(studio, 'devDependencies', 'Studio');
  const peerDependencies = readRequiredSection(studio, 'peerDependencies', 'Studio');
  const colorTheoryDevDependencies = readRequiredSection(
    colorTheory,
    'devDependencies',
    'Color Theory',
  );
  return createGeneratedPackagePolicy({
    dependencies,
    devDependencies,
    peerDependencies,
    typesCulori: readRequiredString(colorTheoryDevDependencies, '@types/culori', 'Color Theory'),
    version: readStudioVersion(studio),
    packageManager: readStudioPackageManager(studio),
  });
}

/*** Build the generated-app package policy from validated owner sections. */
function createGeneratedPackagePolicy(input: {
  readonly dependencies: Readonly<Record<string, unknown>>;
  readonly devDependencies: Readonly<Record<string, unknown>>;
  readonly peerDependencies: Readonly<Record<string, unknown>>;
  readonly typesCulori: string;
  readonly version: string;
  readonly packageManager: string;
}): GeneratedPackagePolicy {
  return {
    packageManager: input.packageManager,
    dependencies: readGeneratedRuntimeDependencies(input.dependencies, input.version),
    devDependencies: {
      ankh: readRequiredString(input.devDependencies, '@ankhorage/ankh', 'Studio'),
      devtools: readRequiredString(input.devDependencies, '@ankhorage/devtools', 'Studio'),
      typesBun: readRequiredString(input.devDependencies, '@types/bun', 'Studio'),
      typesCulori: input.typesCulori,
      typesReact: readRequiredString(input.devDependencies, '@types/react', 'Studio'),
    },
    peerDependencies: readGeneratedPeerDependencies(input.peerDependencies),
  };
}

/*** Read generated runtime dependency ranges from Studio's dependency contract. */
function readGeneratedRuntimeDependencies(
  dependencies: Readonly<Record<string, unknown>>,
  version: string,
): GeneratedPackagePolicy['dependencies'] {
  return {
    contracts: readRequiredString(dependencies, '@ankhorage/contracts', 'Studio'),
    dataSources: readRequiredString(dependencies, '@ankhorage/data-sources', 'Studio'),
    expoRuntime: readRequiredString(dependencies, '@ankhorage/expo-runtime', 'Studio'),
    navigator: readRequiredString(dependencies, '@ankhorage/navigator', 'Studio'),
    runtime: readRequiredString(dependencies, '@ankhorage/runtime', 'Studio'),
    studio: `^${version}`,
    utility: readRequiredString(dependencies, '@ankhorage/utility', 'Studio'),
    supabaseAuth: readRequiredString(dependencies, '@ankhorage/supabase-auth', 'Studio'),
    supabaseStorage: readRequiredString(dependencies, '@ankhorage/supabase-storage', 'Studio'),
    zora: readRequiredString(dependencies, '@ankhorage/zora', 'Studio'),
  };
}

/*** Read generated native peer ranges from Studio's peer dependency contract. */
function readGeneratedPeerDependencies(
  peerDependencies: Readonly<Record<string, unknown>>,
): GeneratedPackagePolicy['peerDependencies'] {
  return {
    nativePicker: readRequiredString(peerDependencies, '@react-native-picker/picker', 'Studio'),
    fontawesome: readRequiredString(
      peerDependencies,
      '@react-native-vector-icons/fontawesome',
      'Studio',
    ),
    fontawesome5: readRequiredString(
      peerDependencies,
      '@react-native-vector-icons/fontawesome5',
      'Studio',
    ),
    fontawesome6: readRequiredString(
      peerDependencies,
      '@react-native-vector-icons/fontawesome6',
      'Studio',
    ),
    ionicons: readRequiredString(
      peerDependencies,
      '@react-native-vector-icons/ionicons',
      'Studio',
    ),
  };
}

/*** Parse one owner package manifest as a validated object. */
function readPackageManifest(
  source: URL | string,
  ownerName: string,
): Readonly<Record<string, unknown>> {
  const manifest: unknown = JSON.parse(readFileSync(source, 'utf8'));
  if (!isRecord(manifest)) throw new Error(`${ownerName} package.json must contain an object.`);
  return manifest;
}

/*** Read and validate Studio's exact package version. */
function readStudioVersion(studio: Readonly<Record<string, unknown>>): string {
  const version = readRequiredString(studio, 'version', 'Studio');
  if (!SEMVER_PATTERN.test(version)) {
    throw new Error('Studio package.json version must be exact semver.');
  }
  return version;
}

/*** Read and validate Studio's exact Bun package-manager pin. */
function readStudioPackageManager(studio: Readonly<Record<string, unknown>>): string {
  const packageManager = readRequiredString(studio, 'packageManager', 'Studio');
  if (!BUN_PACKAGE_MANAGER_PATTERN.test(packageManager)) {
    throw new Error('Studio package.json packageManager must pin an exact Bun version.');
  }
  return packageManager;
}

/*** Read one required package-manifest dependency section. */
function readRequiredSection(
  manifest: Readonly<Record<string, unknown>>,
  sectionName: string,
  ownerName: string,
): Readonly<Record<string, unknown>> {
  const section = readOwnProperty(manifest, sectionName);
  if (!isRecord(section)) {
    throw new Error(`${ownerName} package.json ${sectionName} must be an object.`);
  }
  return section;
}

/*** Read one required non-empty string property from package metadata. */
function readRequiredString(
  record: Readonly<Record<string, unknown>>,
  key: string,
  ownerName: string,
): string {
  const value = readOwnProperty(record, key);
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${ownerName} package metadata must define ${key} as a non-empty string.`);
  }
  return value;
}
