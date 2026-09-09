import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, test } from 'bun:test';

import { getGeneratedPackagePolicy } from './generatedPackagePolicy';
import { reconcileProjectPackageRootAsync } from './reconcileProjectPackageRootAsync';
import { getPackageJson } from './templates';

const temporaryDirectories: string[] = [];
const WEB_TARGETS = { web: { enabled: true } } as const;

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

test('updates owner ranges before installs and runs only app-level Devtools concerns', async () => {
  const { projectPath, ankhExecutable } = await createProjectRoot();
  const calls: { command: string; args: readonly string[]; cwd: string }[] = [];
  let firstInstallObserved = false;

  await reconcileProjectPackageRootAsync(projectPath, {
    runCommandAsync: async (command, args, cwd) => {
      if (!firstInstallObserved && command === 'bun') {
        firstInstallObserved = true;
        const packageJson = await readGeneratedPackageJson(projectPath);
        const policy = getGeneratedPackagePolicy();
        expect(packageJson.packageManager).toBe(policy.packageManager);
        expect(packageJson.dependencies['@ankhorage/utility']).toBe(policy.dependencies.utility);
        expect(packageJson.devDependencies['@ankhorage/devtools']).toBe(
          policy.devDependencies.devtools,
        );
      }
      calls.push({ command, args, cwd });
    },
  });

  expect(firstInstallObserved).toBe(true);
  expect(calls).toEqual([
    { command: 'bun', args: ['install'], cwd: projectPath },
    {
      command: ankhExecutable,
      args: ['devtools', 'package', 'sync', '.'],
      cwd: projectPath,
    },
    {
      command: ankhExecutable,
      args: ['devtools', 'eslint', 'sync', '.'],
      cwd: projectPath,
    },
    {
      command: ankhExecutable,
      args: ['devtools', 'prettier', 'sync', '.'],
      cwd: projectPath,
    },
    {
      command: ankhExecutable,
      args: ['devtools', 'knip', 'sync', '.'],
      cwd: projectPath,
    },
    { command: 'bun', args: ['install', '--frozen-lockfile'], cwd: projectPath },
  ]);
});

test('runs full Devtools synchronization when preparing a standalone repository', async () => {
  const { projectPath, ankhExecutable } = await createProjectRoot();
  const calls: { command: string; args: readonly string[]; cwd: string }[] = [];

  await reconcileProjectPackageRootAsync(projectPath, {
    devtoolsScope: 'repository',
    runCommandAsync: async (command, args, cwd) => {
      await Promise.resolve();
      calls.push({ command, args, cwd });
    },
  });

  expect(calls).toEqual([
    { command: 'bun', args: ['install'], cwd: projectPath },
    { command: ankhExecutable, args: ['devtools', 'sync', '.'], cwd: projectPath },
    { command: 'bun', args: ['install', '--frozen-lockfile'], cwd: projectPath },
  ]);
});

/*** Create one generated project fixture with deliberately stale generator-owned package ranges. */
async function createProjectRoot(): Promise<{
  readonly projectPath: string;
  readonly ankhExecutable: string;
}> {
  const projectPath = await mkdtemp(path.join(tmpdir(), 'ankh-project-package-'));
  temporaryDirectories.push(projectPath);
  const ankhExecutable = path.join(projectPath, 'node_modules', '.bin', 'ankh');
  await mkdir(path.dirname(ankhExecutable), { recursive: true });
  await writeFile(ankhExecutable, '', 'utf8');
  const packageJson = getPackageJson({
    name: 'fixture',
    authProvider: 'supabase',
    storageProvider: 'supabase',
    targets: WEB_TARGETS,
  });
  await writeFile(
    path.join(projectPath, 'package.json'),
    `${JSON.stringify(packageJson, null, 2)}\n`,
    'utf8',
  );
  return { projectPath, ankhExecutable };
}

/*** Read and validate the generated package fields exercised by package-root reconciliation. */
async function readGeneratedPackageJson(projectPath: string): Promise<{
  readonly packageManager: string;
  readonly dependencies: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
}> {
  const value: unknown = JSON.parse(await readFile(path.join(projectPath, 'package.json'), 'utf8'));
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Generated package test fixture must contain an object.');
  }
  const packageManager = Reflect.get(value, 'packageManager');
  if (typeof packageManager !== 'string') {
    throw new Error('Generated package test fixture must define packageManager.');
  }
  return {
    packageManager,
    dependencies: readStringRecord(Reflect.get(value, 'dependencies'), 'dependencies'),
    devDependencies: readStringRecord(Reflect.get(value, 'devDependencies'), 'devDependencies'),
  };
}

/*** Read one string-valued dependency section from the generated package fixture. */
function readStringRecord(value: unknown, label: string): Readonly<Record<string, string>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Generated package test fixture must define ${label}.`);
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if (typeof entry !== 'string') {
        throw new Error(`Generated package test fixture ${label}.${key} must be a string.`);
      }
      return [key, entry] as const;
    }),
  );
}
