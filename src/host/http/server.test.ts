import { afterEach, describe, expect, test } from 'bun:test';

import { ModuleManager } from '../orchestrator/moduleManager';
import { ProjectManager } from '../orchestrator/projectManager';
import { createStudioHostServer } from './server';

const servers: Awaited<ReturnType<typeof createStudioHostServer>>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe('createStudioHostServer', () => {
  test('serves the existing health route through the canonical Fastify host and CORS boundary', async () => {
    const projectRoot = '/workspace';
    const server = await createStudioHostServer({
      projectManager: new ProjectManager(projectRoot),
      orchestrator: new ModuleManager(projectRoot),
      projectRoot,
    });
    servers.push(server);

    const health = await server.inject({ method: 'GET', url: '/health' });
    expect(health.statusCode).toBe(200);
    expect(JSON.parse(health.body) as unknown).toEqual({ status: 'ok', workspace: projectRoot });

    const preflight = await server.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': 'GET',
      },
    });
    expect(preflight.statusCode).toBe(204);
    expect(preflight.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });
});
