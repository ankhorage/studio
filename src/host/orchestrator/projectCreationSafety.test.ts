import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, test } from 'bun:test';

import { ProjectCreationValidationError } from '../../projectIdentity';
import { createSmokeProjectSource } from '../smoke/createSmokeProjectSource';
import { ProjectManager } from './projectManager';

test('project creation rejects duplicate and reserved IDs before mutation', async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'studio-create-safety-'));
  await mkdir(path.join(workspaceRoot, 'apps', 'studio'), { recursive: true });
  await writeFile(
    path.join(workspaceRoot, 'package.json'),
    JSON.stringify({ name: '@ankhorage/studio', private: true, workspaces: ['apps/*'] }),
  );

  const manager = new ProjectManager(workspaceRoot);
  const created = await manager.createProject('Foo', createSmokeProjectSource());
  expect(created.id).toBe('foo');

  const duplicateError = await catchError(
    manager.createProject('Foo', createSmokeProjectSource()),
  );
  expect(duplicateError).toBeInstanceOf(ProjectCreationValidationError);

  const manifest = JSON.parse(
    await readFile(path.join(workspaceRoot, 'apps', 'foo', 'ankh.config.json'), 'utf8'),
  ) as { metadata: { name: string; category: string } };
  expect(manifest.metadata.name).toBe('Foo');
  expect(manifest.metadata.category).toBe('developer_tools');

  const reservedError = await catchError(
    manager.createProject('Studio', createSmokeProjectSource()),
  );
  expect(reservedError).toBeInstanceOf(ProjectCreationValidationError);
  expect(await stat(path.join(workspaceRoot, 'apps', 'studio'))).toBeDefined();
});

async function catchError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
    return null;
  } catch (caught) {
    return caught;
  }
}
