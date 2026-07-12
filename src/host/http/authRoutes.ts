import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { ProjectAuthService, type ProjectAuthSettingsResult } from '../auth/projectAuthService';
import type { ProjectManager } from '../orchestrator/projectManager';

export function registerProjectAuthRoutes(
  fastify: FastifyInstance,
  options: { readonly projectManager: ProjectManager },
): void {
  const service = new ProjectAuthService(options.projectManager);

  fastify.get('/api/projects/:id/auth/config', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };
    return sendProjectAuthResult(reply, await service.get(id));
  });

  fastify.put('/api/projects/:id/auth/config', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };
    const body = asRecord(request.body);
    if (!body || !Object.hasOwn(body, 'config')) {
      return reply.status(400).send({
        ok: false,
        error: {
          code: 'invalid_config',
          message: 'Auth configuration request requires a config object.',
        },
      });
    }

    return sendProjectAuthResult(reply, await service.configure(id, body.config));
  });
}

function sendProjectAuthResult(reply: FastifyReply, result: ProjectAuthSettingsResult) {
  if (result.ok) return result;

  const status = result.error.code === 'invalid_config' ? 400 : 500;
  return reply.status(status).send(result);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
