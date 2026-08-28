import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'bun:test';

import { GeneratedRouteFileOwnership } from './GeneratedRouteFileOwnership';

const projectPaths: string[] = [];

afterEach(async () => {
  await Promise.all(
    projectPaths
      .splice(0)
      .map((projectPath) => fs.rm(projectPath, { recursive: true, force: true })),
  );
});

describe('GeneratedRouteFileOwnership', () => {
  it('initializes current route ownership during project creation', async () => {
    const projectPath = await createProjectPath();
    const ownership = new GeneratedRouteFileOwnership();

    await ownership.initialize(projectPath, ['src/app/index.tsx', 'src/app/_layout.tsx']);

    expect(await readLedger(projectPath)).toMatchObject({
      schemaVersion: 1,
      files: ['src/app/_layout.tsx', 'src/app/index.tsx'],
    });
    await ownership.assertSyncable(projectPath);
  });

  it('requires route ownership state before project sync', async () => {
    const projectPath = await createProjectPath();
    const ownership = new GeneratedRouteFileOwnership();

    return expect(ownership.assertSyncable(projectPath)).rejects.toThrow(
      'Project route ownership state is missing',
    );
  });

  it('rejects malformed route ownership state', async () => {
    const projectPath = await createProjectPath();
    const ownership = new GeneratedRouteFileOwnership();

    await writeLedger(projectPath, '{not-json');
    return expect(ownership.assertSyncable(projectPath)).rejects.toThrow(
      'Project route ownership state is invalid',
    );
  });

  it('rejects unsupported route ownership state', async () => {
    const projectPath = await createProjectPath();
    const ownership = new GeneratedRouteFileOwnership();

    await writeLedger(projectPath, JSON.stringify({ schemaVersion: 2, files: [] }));
    return expect(ownership.assertSyncable(projectPath)).rejects.toThrow(
      'Project route ownership state is invalid',
    );
  });

  it('rejects absolute route ownership paths', async () => {
    const projectPath = await createProjectPath();
    const ownership = new GeneratedRouteFileOwnership();

    await writeLedger(
      projectPath,
      JSON.stringify({ schemaVersion: 1, generatedAt: 'now', files: [projectPath] }),
    );
    return expect(ownership.assertSyncable(projectPath)).rejects.toThrow(
      'Project route ownership state is invalid',
    );
  });

  it('rejects out-of-scope app-owned ledger entries without deleting them', async () => {
    const projectPath = await createProjectPath();
    const ownership = new GeneratedRouteFileOwnership();
    const appOwnedPath = path.join(projectPath, 'package.json');
    await fs.writeFile(appOwnedPath, '{"name":"app-owned"}\n', 'utf8');
    await writeLedger(
      projectPath,
      JSON.stringify({ schemaVersion: 1, generatedAt: 'now', files: ['package.json'] }),
    );

    const error = await catchError(ownership.reconcile(projectPath, []));

    expect(error).toBeInstanceOf(Error);
    expect(error instanceof Error ? error.message : '').toContain(
      'Project route ownership state is invalid',
    );
    expect(await fs.readFile(appOwnedPath, 'utf8')).toBe('{"name":"app-owned"}\n');
  });

  it('removes only stale current-owned files and preserves neighboring app-owned files', async () => {
    const projectPath = await createProjectPath();
    const ownership = new GeneratedRouteFileOwnership();
    const stalePath = path.join(projectPath, 'src/app/stale.tsx');
    const retainedPath = path.join(projectPath, 'src/app/index.tsx');
    const appOwnedPath = path.join(projectPath, 'src/app/app-owned.tsx');
    await fs.mkdir(path.dirname(stalePath), { recursive: true });
    await fs.writeFile(stalePath, 'stale generated route', 'utf8');
    await fs.writeFile(retainedPath, 'current generated route', 'utf8');
    await fs.writeFile(
      appOwnedPath,
      "import ankhConfig from '@root/ankh.config.json';\nRuntimeRenderer currentScreenId\n",
      'utf8',
    );
    await ownership.initialize(projectPath, ['src/app/stale.tsx', 'src/app/index.tsx']);

    await ownership.reconcile(projectPath, ['src/app/index.tsx']);

    expect(await pathExists(stalePath)).toBe(false);
    expect(await fs.readFile(retainedPath, 'utf8')).toBe('current generated route');
    expect(await fs.readFile(appOwnedPath, 'utf8')).toContain('RuntimeRenderer');
    expect(await readLedger(projectPath)).toMatchObject({ files: ['src/app/index.tsx'] });
  });

  it('surfaces stale-file deletion failures without advancing ownership state', async () => {
    const projectPath = await createProjectPath();
    const ownership = new GeneratedRouteFileOwnership();
    const stalePath = path.join(projectPath, 'src/app/stale.tsx');
    await fs.mkdir(stalePath, { recursive: true });
    await ownership.initialize(projectPath, ['src/app/stale.tsx']);

    const error = await catchError(ownership.reconcile(projectPath, []));

    expect(error).toBeInstanceOf(Error);
    expect(await readLedger(projectPath)).toMatchObject({ files: ['src/app/stale.tsx'] });
  });
});

async function catchError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    return error;
  }
}

async function createProjectPath(): Promise<string> {
  const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'ankh-route-ownership-'));
  projectPaths.push(projectPath);
  return projectPath;
}

async function readLedger(projectPath: string): Promise<unknown> {
  return JSON.parse(
    await fs.readFile(path.join(projectPath, '.ankh/route-ledger.json'), 'utf8'),
  ) as unknown;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeLedger(projectPath: string, source: string): Promise<void> {
  const ledgerPath = path.join(projectPath, '.ankh/route-ledger.json');
  await fs.mkdir(path.dirname(ledgerPath), { recursive: true });
  await fs.writeFile(ledgerPath, source, 'utf8');
}
