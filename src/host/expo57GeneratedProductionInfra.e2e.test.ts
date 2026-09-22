import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from 'bun:test';

import { ProjectManager } from './orchestrator/projectManager';
import { createMinimalProjectSource } from './orchestrator/createMinimalProjectSource';

const COMMAND_TIMEOUT_MS = 1_800_000;
const productionInfraTest = process.env.ANKH_STUDIO_EXPO57_INFRA_E2E === '1' ? test : test.skip;

productionInfraTest(
  'generates an Expo 57 app and reconciles its backend through the provider-neutral Infra lifecycle',
  async () => {
    assertNode24();
    const workspaceRoot = await mkdtemp(path.join('/tmp', 'ankh-expo57-production-infra-'));
    const manager = new ProjectManager(workspaceRoot);
    let projectId: string | null = null;

    try {
      await mkdir(path.join(workspaceRoot, 'apps'), { recursive: true });
      await writeFile(
        path.join(workspaceRoot, 'package.json'),
        JSON.stringify({
          name: '@ankhorage/expo57-production-infra-acceptance',
          packageManager: 'bun@1.4.2',
          private: true,
        }),
      );
      const created = await manager.createProject(
        'Expo 57 Production Infra',
        createMinimalProjectSource(),
        undefined,
        { includeStudio: false },
      );
      projectId = created.id;

      const up = await manager.upInfrastructure(created.id);
      expect(up.environment).toBe('local');
      expect((await manager.getInfrastructureStatus(created.id)).environment).toBe('local');
      expect((await manager.getInfrastructureOutputs(created.id)).environment).toBe('local');
      expect((await manager.downInfrastructure(created.id)).environment).toBe('local');
      expect((await manager.upInfrastructure(created.id)).environment).toBe('local');
    } finally {
      if (projectId) {
        await manager.destroyInfrastructure(projectId, true).catch(() => undefined);
      }
      await rm(workspaceRoot, { force: true, recursive: true });
    }
  },
  COMMAND_TIMEOUT_MS,
);

function assertNode24(): void {
  if (!process.version.startsWith('v24.')) {
    throw new Error(`Node 24 LTS is required; received ${process.version}.`);
  }
}
