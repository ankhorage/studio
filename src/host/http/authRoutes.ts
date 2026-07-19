import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import {
  type ProjectAuthHealthResult,
  ProjectAuthHealthService,
} from '../auth/projectAuthHealthService';
import { ProjectAuthService, type ProjectAuthSettingsResult } from '../auth/projectAuthService';
import type { ProjectManager } from '../orchestrator/projectManager';
import { ProjectSecretService } from '../secrets/projectSecretService';

export function registerProjectAuthRoutes(
  fastify: FastifyInstance,
  options: { readonly projectManager: ProjectManager; readonly workspaceRoot?: string },
): void {
  const service = new ProjectAuthService(options.projectManager);
  const healthService =
    options.workspaceRoot === undefined
      ? null
      : new ProjectAuthHealthService({
          projectManager: options.projectManager,
          secretService: new ProjectSecretService({
            projectManager: options.projectManager,
            workspaceRoot: options.workspaceRoot,
          }),
        });

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

  fastify.get('/api/projects/:id/auth/health', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { environment?: string };
    if (!healthService) {
      return reply.status(503).send({
        ok: false,
        error: {
          code: 'secret_store_unavailable',
          message: 'Auth health requires the Studio host secret-store bridge.',
        },
      });
    }

    return sendProjectAuthHealthResult(
      reply,
      await healthService.get({ projectId: id, environment: query.environment }),
    );
  });
}

function sendProjectAuthResult(reply: FastifyReply, result: ProjectAuthSettingsResult) {
  if (result.ok) return result;

  const status =
    result.error.code === 'invalid_config'
      ? 400
      : result.error.code === 'manifest_write_disabled'
        ? 409
        : 500;
  return reply.status(status).send(result);
}

function sendProjectAuthHealthResult(reply: FastifyReply, result: ProjectAuthHealthResult) {
  if (result.ok) return result;

  return reply.status(500).send(result);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
