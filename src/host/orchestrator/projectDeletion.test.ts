import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, test } from 'bun:test';

import { cleanupProjectGeneratedAppImage, type CommandRunner } from './projectDeletion';

test('cleans generated images according to destroy lifecycle env', async () => {
  const projectPath = await mkdtemp(path.join(tmpdir(), 'ankh-studio-image-cleanup-'));
  const infraRoot = path.join(projectPath, 'infra', 'minikube');
  await mkdir(infraRoot, { recursive: true });
  await writeFile(
    path.join(infraRoot, '.env.example'),
    [
      'APP_IMAGE=ankh/demo-app:latest',
      'ANKH_APP_SLUG=demo-slug',
      'APP_IMAGE_CLEANUP_ON_DESTROY=true',
      '',
    ].join('\n'),
  );

  const calls: { command: string; args: string[] }[] = [];
  const runner: CommandRunner = {
    run(command, args) {
      calls.push({ command, args });
      return Promise.resolve({ stdout: '', stderr: '' });
    },
  };

  const result = await cleanupProjectGeneratedAppImage({
    projectId: 'demo',
    projectPath,
    target: 'minikube',
    runner,
  });

  expect(result.removedImages).toBe(2);
  expect(calls).toEqual([
    { command: 'minikube', args: ['-p', 'demo-slug', 'image', 'rm', 'ankh/demo-app:latest'] },
    { command: 'docker', args: ['image', 'rm', 'ankh/demo-app:latest'] },
  ]);
});

test('skips generated image cleanup when destroy cleanup is disabled', async () => {
  const projectPath = await mkdtemp(path.join(tmpdir(), 'ankh-studio-image-cleanup-'));
  const infraRoot = path.join(projectPath, 'infra', 'minikube');
  await mkdir(infraRoot, { recursive: true });
  await writeFile(
    path.join(infraRoot, '.env'),
    ['APP_IMAGE=ankh/demo-app:latest', 'APP_IMAGE_CLEANUP_ON_DESTROY=false', ''].join('\n'),
  );

  const runner: CommandRunner = {
    run() {
      return Promise.reject(new Error('runner should not be called'));
    },
  };

  const result = await cleanupProjectGeneratedAppImage({
    projectId: 'demo',
    projectPath,
    target: 'minikube',
    runner,
  });

  expect(result.removedImages).toBe(0);
  expect(result.skipped?.reason).toContain('APP_IMAGE_CLEANUP_ON_DESTROY=false');
});
