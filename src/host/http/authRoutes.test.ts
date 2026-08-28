import { describe, expect, test } from 'bun:test';
import Fastify from 'fastify';

import type { ProjectManager } from '../orchestrator/projectManager';
import { registerProjectAuthRoutes } from './authRoutes';

describe('registerProjectAuthRoutes', () => {
  test('fails closed when the current auth health service is unavailable', async () => {
    const fastify = Fastify();
    registerProjectAuthRoutes(fastify, {
      projectManager: {} as ProjectManager,
    });
    await fastify.ready();

    const getHealth = await fastify.inject({
      method: 'GET',
      url: '/api/projects/demo/auth/health',
    });

    expect(getHealth.statusCode).toBe(503);
    const healthPayload: unknown = JSON.parse(getHealth.payload);
    expect(healthPayload).toEqual({
      ok: false,
      error: {
        code: 'secret_store_unavailable',
        message: 'Auth health requires the Studio host secret-store bridge.',
      },
    });

    await fastify.close();
  });
});
