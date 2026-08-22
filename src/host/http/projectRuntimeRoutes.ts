import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import {
  ensureProjectInfrastructureRuntimeSession,
  ensureProjectWebLaunchSession,
  type InfraSessionDependencies,
} from '../orchestrator/infraSession';
import type { ProjectManager } from '../orchestrator/projectManager';
import { getProjectPath } from '../orchestrator/projectPaths';

type ProjectRuntimeManager = Pick<ProjectManager, 'getInfrastructureStatus'>;

export function registerProjectRuntimeRoutes(
  fastify: FastifyInstance,
  options: {
    readonly projectManager: ProjectRuntimeManager;
    readonly workspaceRoot: string;
    readonly dependencies?: InfraSessionDependencies;
  },
): void {
  fastify.post('/api/projects/:id/launch', (request, reply) =>
    handleProjectRuntimeRequest(request, reply, options, async ({ args, target }) => {
      const runtime = await ensureProjectWebLaunchSession(args, options.dependencies);
      return {
        success: true,
        target,
        url: runtime.url,
        started: runtime.started,
      };
    }),
  );

  fastify.post('/api/projects/:id/infra/runtime/ensure', (request, reply) =>
    handleProjectRuntimeRequest(request, reply, options, async ({ args, target }) => {
      await ensureProjectInfrastructureRuntimeSession(args, options.dependencies);
      return { success: true, target };
    }),
  );
}

async function handleProjectRuntimeRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  options: {
    readonly projectManager: ProjectRuntimeManager;
    readonly workspaceRoot: string;
  },
  run: (context: {
    readonly args: {
      readonly projectId: string;
      readonly projectPath: string;
      readonly target: string;
    };
    readonly target: string;
  }) => Promise<unknown>,
): Promise<unknown> {
  const { id } = request.params as { readonly id: string };
  try {
    const status = await options.projectManager.getInfrastructureStatus(id);
    if (status.skipped) {
      return { success: true, skipped: status.skipped };
    }
    if (!status.target) {
      throw new Error(`Project '${id}' has no infrastructure target. Run Infrastructure Up first.`);
    }

    return await run({
      args: {
        projectId: id,
        projectPath: getProjectPath(options.workspaceRoot, id),
        target: status.target,
      },
      target: status.target,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return reply.status(500).send({ error: message });
  }
}
