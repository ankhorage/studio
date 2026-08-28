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

  it('requires current route ownership state before project sync', async () => {
    const projectPath = await createProjectPath();
    const ownership = new GeneratedRouteFileOwnership();

    await expect(ownership.assertSyncable(projectPath)).rejects.toThrow(
      'Project route ownership state is missing',
    );

    await writeLedger(projectPath, '{not-json');
    await expect(ownership.assertSyncable(projectPath)).rejects.toThrow(
      'Project route ownership state is invalid',
    );

    await writeLedger(projectPath, JSON.stringify({ schemaVersion: 2, files: [] }));
    await expect(ownership.assertSyncable(projectPath)).rejects.toThrow(
      'Project route ownership state is invalid',
    );

    await writeLedger(
      projectPath,
      JSON.stringify({ schemaVersion: 1, generatedAt: 'now', files: [projectPath] }),
    );
    await expect(ownership.assertSyncable(projectPath)).rejects.toThrow(
      'Invalid generated route ownership path',
    );
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

    await expect(fs.access(stalePath)).rejects.toMatchObject({ code: 'ENOENT' });
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

    await expect(ownership.reconcile(projectPath, [])).rejects.toThrow();

    expect(await readLedger(projectPath)).toMatchObject({ files: ['src/app/stale.tsx'] });
  });
});

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

async function writeLedger(projectPath: string, source: string): Promise<void> {
  const ledgerPath = path.join(projectPath, '.ankh/route-ledger.json');
  await fs.mkdir(path.dirname(ledgerPath), { recursive: true });
  await fs.writeFile(ledgerPath, source, 'utf8');
}
