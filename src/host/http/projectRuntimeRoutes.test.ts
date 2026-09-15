import { afterEach, describe, expect, test } from 'bun:test';
import Fastify, { type FastifyInstance } from 'fastify';

import { registerProjectRuntimeRoutes } from './projectRuntimeRoutes';

const servers: FastifyInstance[] = [];
const ledger = {
  schemaVersion: 1 as const,
  projectId: 'project-one',
  environment: 'local' as const,
  targets: [],
  resources: [],
  outputs: [],
  artifacts: [],
};

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe('project runtime HTTP adapter', () => {
  test('reconciles through the provider-neutral ProjectManager lifecycle', async () => {
    const calls: string[] = [];
    const server = Fastify({ logger: false });
    registerProjectRuntimeRoutes(server, {
      workspaceRoot: '/workspace',
      projectManager: {
        upInfrastructure: (projectId) => {
          calls.push(projectId);
          return Promise.resolve({
            environment: 'local',
            targets: [],
            resources: [],
            outputs: [],
            ledger,
          });
        },
      },
    });
    servers.push(server);

    const response = await server.inject({
      method: 'POST',
      url: '/api/projects/project-one/infra/runtime/ensure',
    });

    expect(response.statusCode).toBe(200);
    expect(calls).toEqual(['project-one']);
    expect(JSON.parse(response.body) as unknown).toEqual({
      success: true,
      reconciled: {
        environment: 'local',
        targets: [],
        resources: [],
        outputs: [],
        ledger,
      },
    });
  });

  test('returns a bounded error for lifecycle failures', async () => {
    const server = Fastify({ logger: false });
    registerProjectRuntimeRoutes(server, {
      workspaceRoot: '/workspace',
      projectManager: {
        upInfrastructure: () => Promise.reject(new Error('runtime unavailable')),
      },
    });
    servers.push(server);

    const response = await server.inject({
      method: 'POST',
      url: '/api/projects/project-one/infra/runtime/ensure',
    });

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body) as unknown).toEqual({ error: 'runtime unavailable' });
  });
});
