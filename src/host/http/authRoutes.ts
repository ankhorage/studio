import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import {
  type ProjectAuthHealthResult,
  ProjectAuthHealthService,
} from '../auth/projectAuthHealthService';
import type { ProjectManager } from '../orchestrator/projectManager';
import { ProjectSecretService } from '../secrets/projectSecretService';

export function registerProjectAuthRoutes(
  fastify: FastifyInstance,
  options: { readonly projectManager: ProjectManager; readonly workspaceRoot?: string },
): void {
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

function sendProjectAuthHealthResult(reply: FastifyReply, result: ProjectAuthHealthResult) {
  if (result.ok) return result;

  return reply.status(500).send(result);
}
