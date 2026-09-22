import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { AppManifest } from '@ankhorage/contracts';
import type { InfraLedger } from '@ankhorage/contracts/infra';
import { expect, test } from 'bun:test';

import { ProjectManager } from './orchestrator/projectManager';

const infraE2eTest = process.env.ANKH_STUDIO_INFRA_E2E === '1' ? test : test.skip;
type ProjectManagerDependencies = NonNullable<ConstructorParameters<typeof ProjectManager>[1]>;
type InfraLifecycle = NonNullable<ProjectManagerDependencies['infraLifecycle']>;

infraE2eTest(
  'delegates the complete project lifecycle through the provider-neutral Infra owner',
  async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'ankh-studio-infra-e2e-'));
    const projectId = 'studio-e2e';
    const projectPath = path.join(workspaceRoot, 'apps', projectId);
    const calls: string[] = [];
    const ledger = createLedger(projectId);
    const lifecycle: InfraLifecycle = {
      generateAsync: (request) => {
        calls.push(`generate:${request.projectId}`);
        return Promise.resolve({ environment: 'local', artifacts: [], ledger });
      },
      upAsync: (request) => {
        calls.push(`up:${request.projectId}`);
        return Promise.resolve({
          environment: 'local',
          targets: [],
          resources: [],
          outputs: [],
          ledger,
        });
      },
      statusAsync: (request) => {
        calls.push(`status:${request.projectId}`);
        return Promise.resolve({
          projectId: request.projectId,
          environment: 'local',
          state: 'ready',
          resources: [],
        });
      },
      outputsAsync: (request) => {
        calls.push(`outputs:${request.projectId}`);
        return Promise.resolve({ environment: 'local', outputs: [] });
      },
      downAsync: (request) => {
        calls.push(`down:${request.projectId}`);
        return Promise.resolve({ environment: 'local', ledger });
      },
      hasOwnedResourcesAsync: () => Promise.resolve(false),
      destroyAsync: (request) => {
        calls.push(`destroy:${request.projectId}:${request.deletePersistentResources}`);
        return Promise.resolve({ environment: 'local', ledger: null });
      },
    };

    try {
      await mkdir(projectPath, { recursive: true });
      await writeFile(path.join(projectPath, 'package.json'), JSON.stringify({ name: '@e2e/app' }));
      await writeFile(
        path.join(projectPath, 'ankh.config.json'),
        JSON.stringify(createManifest(projectId)),
      );
      const manager = new ProjectManager(workspaceRoot, { infraLifecycle: lifecycle });

      await manager.regenerateInfrastructure(projectId);
      await manager.upInfrastructure(projectId);
      expect((await manager.getInfrastructureStatus(projectId)).state).toBe('ready');
      expect((await manager.getInfrastructureOutputs(projectId)).outputs).toEqual([]);
      await manager.downInfrastructure(projectId);
      await manager.destroyInfrastructure(projectId, true);

      expect(calls).toEqual([
        'generate:studio-e2e',
        'up:studio-e2e',
        'status:studio-e2e',
        'outputs:studio-e2e',
        'down:studio-e2e',
        'destroy:studio-e2e:true',
      ]);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  },
);

function createLedger(projectId: string): InfraLedger {
  return {
    schemaVersion: 1,
    projectId,
    environment: 'local',
    targets: [],
    resources: [],
    outputs: [],
    artifacts: [],
  };
}

function createManifest(projectId: string): AppManifest {
  return {
    metadata: {
      name: projectId,
      slug: projectId,
      version: '1.0.0',
      category: 'developer_tools',
      themeId: 'default',
    },
    settings: { localization: { defaultLocale: 'en', locales: ['en'] } },
    infra: {
      environments: {
        local: {
          deployment: {
            compute: { provider: 'local' },
            runtime: { provider: 'minikube' },
          },
        },
      },
      modules: {},
    },
    navigator: { type: 'stack', routes: [] },
    screens: {},
    themes: {
      default: {
        id: 'default',
        name: 'Default',
        light: { primaryColor: '#3366ff', harmony: 'analogous' },
        dark: { primaryColor: '#6699ff', harmony: 'analogous' },
      },
    },
    activeThemeId: 'default',
  };
}
