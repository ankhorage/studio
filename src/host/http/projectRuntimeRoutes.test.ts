import { afterEach, describe, expect, test } from 'bun:test';
import Fastify, { type FastifyInstance } from 'fastify';

import { registerProjectRuntimeRoutes } from './projectRuntimeRoutes';

const servers: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe('project runtime HTTP adapter', () => {
  test('launch and explicit runtime ensure use the same canonical runtime session', async () => {
    const calls: unknown[][] = [];
    const server = Fastify({ logger: false });
    registerProjectRuntimeRoutes(server, {
      workspaceRoot: '/workspace',
      projectManager: {
        getInfrastructureStatus: (projectId) => {
          calls.push(['status', projectId]);
          return Promise.resolve({
            generated: true,
            generatedAt: '2026-08-22T00:00:00.000Z',
            hasDeployment: true,
            target: 'minikube',
            trackedFiles: 5,
            warnings: [],
          });
        },
      },
      dependencies: {
        ensureProjectInfrastructureRuntimeSession: (args) => {
          calls.push(['runtime', args]);
          return Promise.resolve({ started: false, url: 'http://127.0.0.1:48123' });
        },
      },
    });
    await server.ready();
    servers.push(server);

    for (const url of [
      '/api/projects/project-one/launch',
      '/api/projects/project-one/infra/runtime/ensure',
    ]) {
      const response = await server.inject({ method: 'POST', url });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body) as unknown).toEqual({
        success: true,
        target: 'minikube',
        url: 'http://127.0.0.1:48123',
        started: false,
      });
    }

    expect(calls).toEqual([
      ['status', 'project-one'],
      [
        'runtime',
        {
          projectId: 'project-one',
          projectPath: '/workspace/apps/project-one',
          target: 'minikube',
        },
      ],
      ['status', 'project-one'],
      [
        'runtime',
        {
          projectId: 'project-one',
          projectPath: '/workspace/apps/project-one',
          target: 'minikube',
        },
      ],
    ]);
  });

  test('returns actionable runtime ensure failures without running Infra Up', async () => {
    const server = Fastify({ logger: false });
    registerProjectRuntimeRoutes(server, {
      workspaceRoot: '/workspace',
      projectManager: {
        getInfrastructureStatus: () =>
          Promise.resolve({
            generated: true,
            generatedAt: null,
            hasDeployment: true,
            target: 'minikube',
            trackedFiles: 0,
            warnings: [],
          }),
      },
      dependencies: {
        ensureProjectInfrastructureRuntimeSession: () =>
          Promise.reject(
            new Error('Run Infrastructure Up to regenerate project infrastructure first.'),
          ),
      },
    });
    await server.ready();
    servers.push(server);

    const response = await server.inject({
      method: 'POST',
      url: '/api/projects/project-one/infra/runtime/ensure',
    });

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body) as unknown).toEqual({
      error: 'Run Infrastructure Up to regenerate project infrastructure first.',
    });
  });
});
