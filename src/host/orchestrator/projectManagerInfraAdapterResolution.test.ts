import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, test } from 'bun:test';

import { createProjectCreationTestSource } from './createProjectCreationTestSource';
import { ProjectManager } from './projectManager';

const workspaceRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    workspaceRoots
      .splice(0)
      .map((workspaceRoot) => rm(workspaceRoot, { force: true, recursive: true })),
  );
});

test('resolves a persisted default Infra environment through Studio composition', async () => {
  const workspaceRoot = await createWorkspaceRoot();
  const projectId = 'infra-adapter-resolution';
  await createProjectRoot(workspaceRoot, projectId);
  const manager = new ProjectManager(workspaceRoot, {
    reconcileProjectPackageRootAsync: async () => {
      await Promise.resolve();
    },
  });
  const manifest = await manager.persistProjectManifest({
    projectId,
    manifest: createProjectCreationTestSource().manifest,
  });
  const generated = await manager.regenerateInfrastructure(projectId);

  expect(manifest.infra.environments.local.deployment.compute.provider).toBe('local');
  expect(manifest.infra.environments.local.deployment.runtime.provider).toBe('minikube');
  expect(manifest.infra.environments.local.database?.provider).toBe('supabase');
  expect(generated.ledger.projectId).toBe(projectId);
  expect(generated.ledger.resources.map(({ identity }) => identity.adapter)).toContain('local');
}, 15_000);

async function createWorkspaceRoot(): Promise<string> {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'studio-infra-adapter-resolution-'));
  workspaceRoots.push(workspaceRoot);
  await mkdir(path.join(workspaceRoot, 'apps'), { recursive: true });
  await writeFile(
    path.join(workspaceRoot, 'package.json'),
    JSON.stringify({ name: 'studio-infra-adapter-resolution', private: true }),
  );
  return workspaceRoot;
}

async function createProjectRoot(workspaceRoot: string, projectId: string): Promise<void> {
  const projectRoot = path.join(workspaceRoot, 'apps', projectId);
  await mkdir(projectRoot, { recursive: true });
  await writeFile(path.join(projectRoot, 'package.json'), JSON.stringify({ name: projectId }));
}
