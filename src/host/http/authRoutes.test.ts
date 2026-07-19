import { describe, expect, test } from 'bun:test';
import Fastify from 'fastify';

import type { ProjectManager } from '../orchestrator/projectManager';
import { registerProjectAuthRoutes } from './authRoutes';

describe('registerProjectAuthRoutes', () => {
  test('does not expose legacy auth manifest config writes', async () => {
    const fastify = Fastify();
    registerProjectAuthRoutes(fastify, {
      projectManager: {} as ProjectManager,
    });
    await fastify.ready();

    const putConfig = await fastify.inject({
      method: 'PUT',
      url: '/api/projects/demo/auth/config',
      payload: { config: {} },
    });
    const getConfig = await fastify.inject({
      method: 'GET',
      url: '/api/projects/demo/auth/config',
    });
    const getHealth = await fastify.inject({
      method: 'GET',
      url: '/api/projects/demo/auth/health',
    });

    expect(putConfig.statusCode).toBe(404);
    expect(getConfig.statusCode).toBe(404);
    expect(getHealth.statusCode).toBe(503);

    await fastify.close();
  });
});
