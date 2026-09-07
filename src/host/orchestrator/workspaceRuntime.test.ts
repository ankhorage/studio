import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, test } from 'bun:test';

import { runWorkspaceInstall } from './workspaceRuntime';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

test('installs a generated app without mutating its Studio parent package state', async () => {
  const studioRoot = await mkdtemp(path.join(tmpdir(), 'ankh-project-install-'));
  temporaryDirectories.push(studioRoot);
  const projectPath = path.join(studioRoot, 'apps', 'generated-app');
  const dependencyPath = path.join(projectPath, 'dependency');
  await Promise.all([
    mkdir(path.join(studioRoot, 'apps', 'studio'), { recursive: true }),
    mkdir(dependencyPath, { recursive: true }),
  ]);
  await Promise.all([
    writeFile(
      path.join(studioRoot, 'package.json'),
      `${JSON.stringify({ name: 'studio-root', private: true, workspaces: ['apps/studio'] })}\n`,
    ),
    writeFile(path.join(studioRoot, 'bun.lock'), 'studio-root-lock-sentinel\n'),
    writeFile(
      path.join(studioRoot, 'apps', 'studio', 'package.json'),
      `${JSON.stringify({ name: 'studio-app', private: true })}\n`,
    ),
    writeFile(
      path.join(projectPath, 'package.json'),
      `${JSON.stringify({ dependencies: { 'fixture-dependency': 'file:./dependency' }, name: 'generated-app', private: true })}\n`,
    ),
    writeFile(
      path.join(dependencyPath, 'package.json'),
      `${JSON.stringify({ name: 'fixture-dependency', version: '1.0.0' })}\n`,
    ),
  ]);

  await runWorkspaceInstall(projectPath);

  expect(await readFile(path.join(studioRoot, 'bun.lock'), 'utf8')).toBe(
    'studio-root-lock-sentinel\n',
  );
  expect((await readFile(path.join(projectPath, 'bun.lock'), 'utf8')).length).toBeGreaterThan(0);
});
