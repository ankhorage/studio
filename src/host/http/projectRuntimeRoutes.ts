import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { ProjectManager } from '../orchestrator/projectManager';

type ProjectRuntimeManager = Pick<ProjectManager, 'upInfrastructure'>;

/*** Register the provider-neutral infrastructure runtime recovery HTTP adapter. */
export function registerProjectRuntimeRoutes(
  fastify: FastifyInstance,
  options: {
    readonly projectManager: ProjectRuntimeManager;
    readonly workspaceRoot: string;
  },
): void {
  /*** Reconcile the project's local infrastructure environment to its desired running state. */
  fastify.post('/api/projects/:id/infra/runtime/ensure', async (request, reply) => {
    const { id } = request.params as { readonly id: string };
    try {
      const reconciled = await options.projectManager.upInfrastructure(id);
      return { success: true, reconciled };
    } catch (error: unknown) {
      return sendRuntimeFailure(reply, error);
    }
  });
}

/*** Translate a project infrastructure runtime failure into the bounded Studio HTTP response. */
function sendRuntimeFailure(reply: FastifyReply, error: unknown): unknown {
  const message = error instanceof Error ? error.message : String(error);
  return reply.status(500).send({ error: message });
}
