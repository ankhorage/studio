import { afterEach, describe, expect, test } from 'bun:test';
import Fastify, { type FastifyInstance } from 'fastify';

import type { StudioModuleState } from '../../moduleAdminContracts';
import type { ModuleManager } from '../orchestrator/moduleManager';
import { registerProjectModuleRoutes } from './moduleRoutes';

const servers: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe('canonical module HTTP adapter', () => {
  test('delegates project-scoped lifecycle and config operations to ModuleManager', async () => {
    const calls: unknown[][] = [];
    const moduleState = createModuleState();
    const orchestrator: Pick<
      ModuleManager,
      | 'applyPendingOperations'
      | 'getModuleState'
      | 'installModule'
      | 'listModules'
      | 'uninstallModule'
      | 'updateModuleConfig'
    > = {
      listModules: (projectId) => {
        calls.push(['listModules', projectId]);
        return Promise.resolve([moduleState]);
      },
      getModuleState: (projectId, moduleId) => {
        calls.push(['getModuleState', projectId, moduleId]);
        return Promise.resolve(moduleState);
      },
      installModule: (projectId, moduleId, config) => {
        calls.push(['installModule', projectId, moduleId, config]);
        return Promise.resolve({
          success: true,
          installed: [moduleId],
          module: moduleState,
          needsReload: false,
        });
      },
      uninstallModule: (projectId, moduleId) => {
        calls.push(['uninstallModule', projectId, moduleId]);
        return Promise.resolve({
          success: true,
          module: moduleState,
          needsReload: true,
          pending: true,
        });
      },
      updateModuleConfig: (projectId, moduleId, config) => {
        calls.push(['updateModuleConfig', projectId, moduleId, config]);
        return Promise.resolve({
          success: true,
          installed: [moduleId],
          reconfigured: moduleId,
          module: moduleState,
          needsReload: false,
        });
      },
      applyPendingOperations: (projectId) => {
        calls.push(['applyPendingOperations', projectId]);
        return Promise.resolve({ success: true, applied: 1 });
      },
    };
    const server = Fastify({ logger: false });
    registerProjectModuleRoutes(server, orchestrator);
    await server.ready();
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
