import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { ApmStatusExtensionEvidencePort } from '@ankhorage/apm/types';
import { expect, test } from 'bun:test';

import { ProjectUpdateService } from './ProjectUpdateService';

const PERMISSIONS = {
  ownerCode: false,
  lifecycleScripts: false,
  externalEffects: false,
} as const;

const createOwnerEvidencePort = (
  projection: 'current' | 'stale',
): ApmStatusExtensionEvidencePort => ({
  inspectExtensionEvidenceAsync: () =>
    Promise.resolve({
      state: 'available',
      complete: true,
      observations: [
        {
          owner: '@ankhorage/studio',
          projection,
          migration: 'not-applicable',
          evidence: [`studio-projection:${projection}`],
        },
      ],
      diagnostics: [],
    }),
});

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

test('preserves Studio owner evidence in status and planning fingerprints', async () => {
  const rootPath = await mkdtemp(path.join(tmpdir(), 'studio-owner-aware-updates-'));
  const manifestPath = path.join(rootPath, 'package.json');
  const manifest = `${JSON.stringify({ name: 'fixture', packageManager: 'bun@1.4.2' }, null, 2)}\n`;
  const currentService = new ProjectUpdateService({
    extensions: createOwnerEvidencePort('current'),
  });
  const staleService = new ProjectUpdateService({ extensions: createOwnerEvidencePort('stale') });

  try {
    await writeFile(manifestPath, manifest, 'utf8');
    const status = await currentService.statusAsync({ rootPath, availability: 'offline' });
    const currentPlan = await currentService.planAsync({ rootPath, availability: 'offline' });
    const stalePlan = await staleService.planAsync({ rootPath, availability: 'offline' });

    expect(status.extensions.state).toBe('available');
    expect(status.extensions.observations).toEqual([
      {
        owner: '@ankhorage/studio',
        projection: 'current',
        migration: 'not-applicable',
        evidence: ['studio-projection:current'],
      },
    ]);
    expect(currentPlan.inputFingerprint.value).not.toBe(stalePlan.inputFingerprint.value);
    expect(await readFile(manifestPath, 'utf8')).toBe(manifest);
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});
