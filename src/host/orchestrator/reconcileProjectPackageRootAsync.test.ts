import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, test } from 'bun:test';

import { reconcileProjectPackageRootAsync } from './reconcileProjectPackageRootAsync';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

test('runs installs and only app-level Devtools concerns from the project root', async () => {
  const projectPath = await mkdtemp(path.join(tmpdir(), 'ankh-project-package-'));
  temporaryDirectories.push(projectPath);
  const ankhExecutable = path.join(projectPath, 'node_modules', '.bin', 'ankh');
  await mkdir(path.dirname(ankhExecutable), { recursive: true });
  await writeFile(ankhExecutable, '', 'utf8');
  const calls: { command: string; args: readonly string[]; cwd: string }[] = [];

  await reconcileProjectPackageRootAsync(projectPath, {
    runCommandAsync: async (command, args, cwd) => {
      await Promise.resolve();
      calls.push({ command, args, cwd });
    },
  });

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
  const projectPath = await mkdtemp(path.join(tmpdir(), 'ankh-project-repository-'));
  temporaryDirectories.push(projectPath);
  const ankhExecutable = path.join(projectPath, 'node_modules', '.bin', 'ankh');
  await mkdir(path.dirname(ankhExecutable), { recursive: true });
  await writeFile(ankhExecutable, '', 'utf8');
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
