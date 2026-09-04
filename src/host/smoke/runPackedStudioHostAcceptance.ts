import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { EXPO_PLATFORM } from '@ankhorage/expo-runtime/platform';

import { runAcceptanceCommandAsync } from './runAcceptanceCommandAsync';

const COMMAND_TIMEOUT_MS = 300_000;
const STUDIO_TARBALL_NAME = 'ankhorage-studio.tgz';
const STUDIO_OWNED_PEERS = {
  '@ankhorage/permissions': '^0.2.3',
  [EXPO_PLATFORM.packages.imagePicker.name]: EXPO_PLATFORM.packages.imagePicker.version,
} as const;

/*** Pack the current Studio branch and validate its host subpath from a cold external consumer.
 * @todo Move this package acceptance harness from src/host/smoke to test/acceptance.
 */
export async function runPackedStudioHostAcceptance(
  options: { readonly keepFixture?: boolean } = {},
): Promise<void> {
  const repositoryRoot = await realpath(process.cwd());
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'ankh-packed-studio-host-'));
  const artifactRoot = path.join(fixtureRoot, 'artifact');
  const consumerRoot = path.join(fixtureRoot, 'consumer');
  const cacheRoot = path.join(fixtureRoot, 'cache');

  try {
    await mkdir(artifactRoot, { recursive: true });
    const tarballPath = path.join(artifactRoot, STUDIO_TARBALL_NAME);
    await buildAndPackStudioAsync(repositoryRoot, tarballPath);
    await createConsumerAsync(consumerRoot, tarballPath);
    await installConsumerAsync(consumerRoot, cacheRoot);
    await assertPackedPackageAsync(consumerRoot, repositoryRoot);
    await runConsumerChecksAsync(consumerRoot, cacheRoot);
    console.log(`Packed Studio host acceptance passed at ${fixtureRoot}.`);
  } finally {
    if (options.keepFixture) console.log(`Retained packed Studio host fixture: ${fixtureRoot}`);
    else await rm(fixtureRoot, { force: true, recursive: true });
  }
}

/*** Assert that the packed package resolves externally and carries required owner dependencies. */
async function assertPackedPackageAsync(
  consumerRoot: string,
  repositoryRoot: string,
): Promise<void> {
  const packageRoot = await realpath(path.join(consumerRoot, 'node_modules/@ankhorage/studio'));
  if (isWithin(packageRoot, repositoryRoot)) {
    throw new Error('Packed Studio host acceptance resolved Studio from the repository checkout.');
  }
  const packageJson = JSON.parse(
    await readFile(path.join(packageRoot, 'package.json'), 'utf8'),
  ) as { readonly dependencies?: Readonly<Record<string, string>> };
  const packedDependencies = new Map(Object.entries(packageJson.dependencies ?? {}));
  for (const [packageName, expectedRange] of Object.entries(STUDIO_OWNED_PEERS)) {
    if (packedDependencies.get(packageName) !== expectedRange) {
      throw new Error(`Packed Studio declares an invalid ${packageName} dependency.`);
    }
    await realpath(path.join(consumerRoot, 'node_modules', packageName));
  }
}

/*** Build and pack the current Studio checkout into the acceptance fixture artifact directory. */
async function buildAndPackStudioAsync(repositoryRoot: string, tarballPath: string): Promise<void> {
  await runAcceptanceCommandAsync({
    args: ['run', 'build'],
    command: 'bun',
    cwd: repositoryRoot,
    label: 'Build current Studio branch',
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
  await runAcceptanceCommandAsync({
    args: ['pm', 'pack', '--filename', tarballPath, '--ignore-scripts', '--quiet'],
    command: 'bun',
    cwd: repositoryRoot,
    label: 'Pack current Studio branch',
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
}

/*** Write the minimal external consumer used to import and typecheck the packed Studio host. */
async function createConsumerAsync(consumerRoot: string, tarballPath: string): Promise<void> {
  await mkdir(consumerRoot, { recursive: true });
  await Promise.all([
    writeFile(
      path.join(consumerRoot, 'host-import.mjs'),
      "await import('@ankhorage/studio/host');\n",
    ),
    writeFile(
      path.join(consumerRoot, 'index.ts'),
      "import { ProjectManager } from '@ankhorage/studio/host';\n\nvoid ProjectManager;\n",
    ),
    writeFile(
      path.join(consumerRoot, 'package.json'),
      `${JSON.stringify(createConsumerPackageJson(tarballPath), null, 2)}\n`,
    ),
    writeFile(
      path.join(consumerRoot, 'tsconfig.json'),
      `${JSON.stringify(createConsumerTsconfig(), null, 2)}\n`,
    ),
  ]);
}

/*** Create the package manifest for the packed-host acceptance consumer. */
function createConsumerPackageJson(tarballPath: string) {
  return {
    name: 'packed-studio-host-consumer',
    private: true,
    type: 'module',
    scripts: { typecheck: 'tsc --noEmit -p tsconfig.json' },
    dependencies: { '@ankhorage/studio': `file:${tarballPath}` },
    devDependencies: {
      '@types/node': '^24.13.3',
      typescript: '~6.0.3',
    },
  } as const;
}

/*** Create the strict TypeScript configuration for the packed-host acceptance consumer. */
function createConsumerTsconfig() {
  return {
    compilerOptions: {
      lib: ['ES2022', 'DOM'],
      module: 'ESNext',
      moduleResolution: 'bundler',
      noEmit: true,
      skipLibCheck: false,
      strict: true,
      target: 'ES2022',
      types: ['node'],
    },
    include: ['index.ts'],
  } as const;
}

/*** Resolve and cold-install the packed-host consumer with an isolated Bun cache. */
async function installConsumerAsync(consumerRoot: string, cacheRoot: string): Promise<void> {
  await runAcceptanceCommandAsync({
    args: ['install', '--lockfile-only'],
    command: 'bun',
    cwd: consumerRoot,
    env: { BUN_INSTALL_CACHE_DIR: cacheRoot },
    label: 'Resolve packed Studio host consumer',
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
  await rm(path.join(consumerRoot, 'node_modules'), { force: true, recursive: true });
  await runAcceptanceCommandAsync({
    args: ['install', '--frozen-lockfile'],
    command: 'bun',
    cwd: consumerRoot,
    env: { BUN_INSTALL_CACHE_DIR: cacheRoot },
    label: 'Cold-install packed Studio host consumer',
    timeoutMs: COMMAND_TIMEOUT_MS,
  });
}

/*** Return whether target is equal to or nested beneath parent.
 * @utility @ankhorage/utility/node/path
 */
function isWithin(target: string, parent: string): boolean {
  const relativePath = path.relative(parent, target);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

/*** Import and typecheck the packed Studio host from the external consumer fixture. */
async function runConsumerChecksAsync(consumerRoot: string, cacheRoot: string): Promise<void> {
  const options = {
    command: 'bun',
    cwd: consumerRoot,
    env: { BUN_INSTALL_CACHE_DIR: cacheRoot },
    timeoutMs: COMMAND_TIMEOUT_MS,
  } as const;
  await runAcceptanceCommandAsync({
    ...options,
    args: ['host-import.mjs'],
    label: 'Import packed Studio host',
  });
  await runAcceptanceCommandAsync({
    ...options,
    args: ['run', 'typecheck'],
    label: 'Typecheck packed Studio host consumer',
  });
}
