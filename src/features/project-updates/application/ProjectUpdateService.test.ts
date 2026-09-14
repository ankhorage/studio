import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, test } from 'bun:test';

import { ProjectUpdateService } from './ProjectUpdateService';

const PERMISSIONS = {
  ownerCode: false,
  lifecycleScripts: false,
  externalEffects: false,
} as const;

test('uses the released APM lifecycle without mutating an incomplete project', async () => {
  const rootPath = await mkdtemp(path.join(tmpdir(), 'studio-project-updates-'));
  const manifestPath = path.join(rootPath, 'package.json');
  const manifest = `${JSON.stringify({ name: 'fixture', packageManager: 'bun@1.4.2' }, null, 2)}\n`;
  const service = new ProjectUpdateService();

  try {
    await writeFile(manifestPath, manifest, 'utf8');
    const status = await service.statusAsync({ rootPath, availability: 'offline' });
    const plan = await service.planAsync({ rootPath, availability: 'offline' });
    const apply = await service.applyAsync({ mode: 'start', plan, permissions: PERMISSIONS });
    const verify = await service.verifyAsync({ rootPath, operationId: 'missing-operation' });

    expect(status.operation).toBe('status');
    expect(plan.operation).toBe('plan');
    expect(plan.complete).toBe(false);
    expect(apply.status).toBe('blocked');
    expect(verify.verified).toBe(false);
    expect(await readFile(manifestPath, 'utf8')).toBe(manifest);
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});
