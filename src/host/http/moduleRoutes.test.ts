import { afterEach, describe, expect, test } from 'bun:test';
import Fastify from 'fastify';

import type { StudioModuleState } from '../../moduleAdminContracts';
import type { ModuleManager } from '../orchestrator/moduleManager';
import type { ProjectManager } from '../orchestrator/projectManager';
import { createStudioHostServer } from './server';

const servers: Awaited<ReturnType<typeof createStudioHostServer>>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe('canonical module HTTP adapter', () => {
  test('delegates project-scoped lifecycle and config operations to ModuleManager', async () => {
    const calls: unknown[][] = [];
    const moduleState = createModuleState();
    const orchestrator = {
      listModules: (...args: unknown[]) => {
        calls.push(['listModules', ...args]);
        return Promise.resolve([moduleState]);
      },
      getModuleState: (...args: unknown[]) => {
        calls.push(['getModuleState', ...args]);
        return Promise.resolve(moduleState);
      },
      installModule: (...args: unknown[]) => {
        calls.push(['installModule', ...args]);
        return Promise.resolve({ success: true, module: moduleState, needsReload: false });
      },
      uninstallModule: (...args: unknown[]) => {
        calls.push(['uninstallModule', ...args]);
        return Promise.resolve({
          success: true,
          module: moduleState,
          needsReload: true,
          pending: true,
        });
      },
      updateModuleConfig: (...args: unknown[]) => {
        calls.push(['updateModuleConfig', ...args]);
        return Promise.resolve({ success: true, module: moduleState, needsReload: false });
      },
      applyPendingOperations: (...args: unknown[]) => {
        calls.push(['applyPendingOperations', ...args]);
        return Promise.resolve({ success: true, applied: 1 });
      },
    } as unknown as ModuleManager;
    const server = await createStudioHostServer({
      projectManager: {} as ProjectManager,
      orchestrator,
      projectRoot: import.meta.dir,
      fastifyInstance: Fastify({ logger: false }),
    });
    servers.push(server);

    expect((await server.inject('/api/projects/project-one/modules')).statusCode).toBe(200);
    expect(
      (await server.inject('/api/projects/project-one/modules/vendor%2Fmodule')).statusCode,
    ).toBe(200);
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/api/projects/project-one/modules/vendor%2Fmodule/install',
          payload: { config: { value: 'one' } },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await server.inject({
          method: 'PUT',
          url: '/api/projects/project-one/modules/vendor%2Fmodule/config',
          payload: { config: { value: 'two' } },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/api/projects/project-one/modules/vendor%2Fmodule/uninstall',
        })
      ).statusCode,
    ).toBe(200);
    expect((await server.inject('/api/modules')).statusCode).toBe(404);
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/api/projects/project-one/modules/finalize-pending',
        })
      ).statusCode,
    ).toBe(200);

    expect(calls).toEqual([
      ['listModules', 'project-one'],
      ['getModuleState', 'project-one', 'vendor/module'],
      ['installModule', 'project-one', 'vendor/module', { value: 'one' }],
      ['updateModuleConfig', 'project-one', 'vendor/module', { value: 'two' }],
      ['uninstallModule', 'project-one', 'vendor/module'],
      ['applyPendingOperations', 'project-one'],
    ]);
  });
});

function createModuleState(): StudioModuleState {
  return {
    id: 'vendor/module',
    name: 'Example',
    description: 'Example module',
    available: true,
    installed: false,
    pendingRemoval: false,
    dependencies: [],
    dependents: [],
    config: null,
    admin: null,
  };
}
