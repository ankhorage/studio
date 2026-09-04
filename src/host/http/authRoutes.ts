import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import {
  type ProjectAuthHealthResult,
  ProjectAuthHealthService,
} from '../auth/projectAuthHealthService';
import type { ProjectManager } from '../orchestrator/projectManager';
import { ProjectSecretService } from '../secrets/projectSecretService';

/*** Register the Studio project-auth health HTTP adapter and compose its secret-store-backed service when available. */
export function registerProjectAuthRoutes(
  fastify: FastifyInstance,
  options: { readonly projectManager: ProjectManager; readonly workspaceRoot?: string },
): void {
  const healthService =
    options.workspaceRoot === undefined
      ? null
      : new ProjectAuthHealthService({
          projectManager: options.projectManager,
          workspaceRoot: options.workspaceRoot,
          secretService: new ProjectSecretService({
            projectManager: options.projectManager,
            workspaceRoot: options.workspaceRoot,
          }),
        });

  /*** Resolve project auth health or return service-unavailable when the host secret-store bridge is absent. */
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

/***
 * Return a successful `{ok}` result directly or send a failed result with a configured server-error status.
 * @utility @ankhorage/utility/http/fastify
 */
function sendProjectAuthHealthResult(reply: FastifyReply, result: ProjectAuthHealthResult) {
  if (result.ok) return result;

  return reply.status(500).send(result);
}
