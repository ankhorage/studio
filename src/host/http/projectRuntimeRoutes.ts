import type { FastifyInstance, FastifyReply } from 'fastify';

import type { ProjectManager } from '../orchestrator/projectManager';

type ProjectRuntimeManager = Pick<
  ProjectManager,
  'getProjectRuntimeProjectionState' | 'upInfrastructure'
>;

/*** Register project runtime status and provider-neutral infrastructure recovery HTTP adapters. */
export function registerProjectRuntimeRoutes(
  fastify: FastifyInstance,
  options: {
    readonly projectManager: ProjectRuntimeManager;
    readonly workspaceRoot: string;
  },
): void {
  /*** Report bounded runtime projection currency for the project's currently persisted manifest. */
  fastify.get('/api/projects/:id/runtime/projection', async (request, reply) => {
    const { id } = request.params as { readonly id: string };
    try {
      return await options.projectManager.getProjectRuntimeProjectionState(id);
    } catch (error: unknown) {
      return sendRuntimeFailure(reply, error);
    }
  });

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

/*** Translate a project runtime failure into the bounded Studio HTTP response. */
function sendRuntimeFailure(reply: FastifyReply, error: unknown): unknown {
  const message = error instanceof Error ? error.message : String(error);
  return reply.status(500).send({ error: message });
}
