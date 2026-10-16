import { access, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, test } from 'bun:test';

import { ProjectCreationValidationError } from '../../projectIdentity';
import { createProjectCreationTestSource } from './createProjectCreationTestSource';
import { ProjectManager } from './projectManager';

test('project creation rejects duplicate and reserved IDs before mutation', async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'studio-create-safety-'));
  await mkdir(path.join(workspaceRoot, 'apps', 'studio'), { recursive: true });
  await writeFile(
    path.join(workspaceRoot, 'package.json'),
    JSON.stringify({ name: '@ankhorage/studio', private: true }),
  );

  const reconciledProjectPaths: string[] = [];
  const manager = new ProjectManager(workspaceRoot, {
    reconcileProjectPackageRootAsync: async (projectPath) => {
      await Promise.resolve();
      reconciledProjectPaths.push(projectPath);
    },
  });
  const created = await manager.createProject('Foo', createProjectCreationTestSource());
  expect(created.id).toBe('foo');
  expect(reconciledProjectPaths).toEqual([created.path]);
  expect(await stat(path.join(created.path, 'eas.json'))).toBeDefined();
  expect(await stat(path.join(created.path, 'metro.config.js'))).toBeDefined();

  const duplicateError = await catchError(
    manager.createProject('Foo', createProjectCreationTestSource()),
  );
  expect(duplicateError).toBeInstanceOf(ProjectCreationValidationError);

  const manifest = JSON.parse(
    await readFile(path.join(workspaceRoot, 'apps', 'foo', 'ankh.config.json'), 'utf8'),
  ) as { metadata: { name: string; category: string } };
  expect(manifest.metadata.name).toBe('Foo');
  expect(manifest.metadata.category).toBe('developer_tools');
  await manager.syncProjectRuntime({ projectId: created.id, mutations: [] });
  expect(reconciledProjectPaths).toEqual([created.path, created.path]);

  const reservedError = await catchError(
    manager.createProject('Studio', createProjectCreationTestSource()),
  );
  expect(reservedError).toBeInstanceOf(ProjectCreationValidationError);
  expect(await stat(path.join(workspaceRoot, 'apps', 'studio'))).toBeDefined();
});

test('owns the standalone Runtime executor outside the route ledger across creation and reconciliation', async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'studio-runtime-artifact-lifecycle-'));
  await mkdir(path.join(workspaceRoot, 'apps', 'studio'), { recursive: true });
  await writeFile(
    path.join(workspaceRoot, 'package.json'),
    JSON.stringify({ name: '@ankhorage/studio', private: true }),
  );
  const manager = new ProjectManager(workspaceRoot, {
    reconcileProjectPackageRootAsync: async () => {
      await Promise.resolve();
    },
  });

  try {
    const created = await manager.createProject(
      'Standalone',
      createProjectCreationTestSource(),
      undefined,
      {
        includeStudio: false,
      },
    );
    const routeLedger = await readLedger(created.path, 'route-ledger.json');
    const runtimeLedger = await readLedger(created.path, 'runtime-artifact-ledger.json');
    const runtimeExecutorPath = path.join(
      created.path,
      'src/generated/runtimeCapabilityExecutor.ts',
    );

    expect(routeLedger).not.toContain('src/generated/runtimeCapabilityExecutor.ts');
    expect(runtimeLedger).toContain('src/generated/runtimeCapabilityExecutor.ts');
    expect(await pathExists(runtimeExecutorPath)).toBe(true);

    await manager.syncProjectRuntime({ includeStudio: true, mutations: [], projectId: created.id });

    expect(await pathExists(runtimeExecutorPath)).toBe(false);
    expect(await readLedger(created.path, 'runtime-artifact-ledger.json')).not.toContain(
      'src/generated/runtimeCapabilityExecutor.ts',
    );
  } finally {
    await rm(workspaceRoot, { force: true, recursive: true });
  }
});

async function catchError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
    return null;
  } catch (caught) {
    return caught;
  }
}

async function readLedger(projectPath: string, ledgerName: string): Promise<string> {
  return await readFile(path.join(projectPath, '.ankh', ledgerName), 'utf8');
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
