import { expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { resolveProjectUpdateRootAsync } from './resolveProjectUpdateRootAsync';

test('resolves an existing generated project without parsing its manifest', async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'studio-update-root-'));
  const projectRoot = path.join(workspaceRoot, 'apps', 'legacy-project');
  try {
    await mkdir(projectRoot, { recursive: true });
    await writeFile(path.join(projectRoot, 'package.json'), '{"name":"legacy-project"}\n', 'utf8');
    await writeFile(
      path.join(projectRoot, 'ankh.config.json'),
      '{"themes":[],"infra":{"modules":[]}}\n',
      'utf8',
    );

    expect(await resolveProjectUpdateRootAsync(workspaceRoot, 'legacy-project')).toBe(projectRoot);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test('rejects missing and invalid project roots', async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'studio-update-root-'));
  try {
    expect(await resolveProjectUpdateRootAsync(workspaceRoot, 'missing-project')).toBeUndefined();
    expect(await resolveProjectUpdateRootAsync(workspaceRoot, '../escape')).toBeUndefined();
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});
