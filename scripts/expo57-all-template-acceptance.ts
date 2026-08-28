import { createHash } from 'node:crypto';
import { cp, mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import path from 'node:path';

import { runAcceptanceCommandAsync } from '../src/host/smoke/runAcceptanceCommandAsync';

const repositoryRoot = await realpath(process.cwd());
const sourceRoot = path.join(repositoryRoot, 'fixtures', 'expo57-all-templates');
const fixtureRoot = await mkdtemp(path.join('/tmp', 'ankh-expo57-template-fixture-'));
const cacheRoot = await mkdtemp(path.join('/tmp', 'ankh-expo57-template-fixture-cache-'));
const keepFixture = process.argv.includes('--keep');
const processEnvironment = Bun.env as unknown as Readonly<Record<string, unknown>>;
const rawTemplateShard = processEnvironment.ANKH_EXPO57_TEMPLATE_SHARD;
const templateShard = typeof rawTemplateShard === 'string' ? rawTemplateShard : undefined;

try {
  await cp(sourceRoot, fixtureRoot, { recursive: true });
  const copiedRoot = await realpath(fixtureRoot);
  if (isWithin(copiedRoot, repositoryRoot)) {
    throw new Error('All-template acceptance fixture must live outside the repository checkout.');
  }
  const environment = {
    BUN_INSTALL_CACHE_DIR: path.join(cacheRoot, 'bun-install'),
    EXPO_NO_TELEMETRY: '1',
  };
  await runAcceptanceCommandAsync({
    args: ['install', '--lockfile-only', '--os=*', '--cpu=*'],
    command: 'bun',
    cwd: copiedRoot,
    env: environment,
    label: 'Create all-template fixture Registry lockfile',
  });
  await rm(path.join(copiedRoot, 'node_modules'), { force: true, recursive: true });
  const lockfilePath = path.join(copiedRoot, 'bun.lock');
  const lockfileDigest = hash(await readFile(lockfilePath));
  await runAcceptanceCommandAsync({
    args: ['install', '--frozen-lockfile'],
    command: 'bun',
    cwd: copiedRoot,
    env: environment,
    label: 'Cold all-template fixture frozen install',
  });
  if (lockfileDigest !== hash(await readFile(lockfilePath))) {
    throw new Error('All-template fixture mutated its frozen Registry lockfile.');
  }
  await runAcceptanceCommandAsync({
    args: ['run', 'accept', '--', ...(keepFixture ? ['--keep'] : [])],
    command: 'bun',
    cwd: copiedRoot,
    env: {
      ...environment,
      ...(templateShard ? { ANKH_EXPO57_TEMPLATE_SHARD: templateShard } : {}),
    },
    label: 'Released Studio all-template acceptance',
    timeoutMs: 7_200_000,
  });
} finally {
  await rm(cacheRoot, { force: true, recursive: true });
  if (keepFixture) console.log(`Retained all-template fixture: ${fixtureRoot}`);
  else await rm(fixtureRoot, { force: true, recursive: true });
}

function hash(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function isWithin(target: string, parent: string): boolean {
  const relativePath = path.relative(parent, target);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}
