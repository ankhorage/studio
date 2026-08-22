import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { ensureProjectInfrastructureRuntimeSession } from '../orchestrator/infraSession';
import type { ProjectManager } from '../orchestrator/projectManager';
import { getProjectPath } from '../orchestrator/projectPaths';

type ProjectRuntimeManager = Pick<ProjectManager, 'getInfrastructureStatus'>;

interface ProjectRuntimeRouteDependencies {
  readonly ensureProjectInfrastructureRuntimeSession: typeof ensureProjectInfrastructureRuntimeSession;
}

const defaultDependencies: ProjectRuntimeRouteDependencies = {
  ensureProjectInfrastructureRuntimeSession,
};

export function registerProjectRuntimeRoutes(
  fastify: FastifyInstance,
  options: {
    readonly projectManager: ProjectRuntimeManager;
    readonly workspaceRoot: string;
    readonly dependencies?: ProjectRuntimeRouteDependencies;
  },
): void {
  const dependencies = options.dependencies ?? defaultDependencies;

  const handler = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { readonly id: string };
    try {
      const status = await options.projectManager.getInfrastructureStatus(id);
      if (status.skipped) {
        return { success: true, skipped: status.skipped };
      }
      if (!status.target) {
        throw new Error(
          `Project '${id}' has no infrastructure target. Run Infrastructure Up first.`,
        );
      }

      const runtime = await dependencies.ensureProjectInfrastructureRuntimeSession({
        projectId: id,
        projectPath: getProjectPath(options.workspaceRoot, id),
        target: status.target,
      });

      return {
        success: true,
        target: status.target,
        url: runtime.url,
        started: runtime.started,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.status(500).send({ error: message });
    }
  };

  fastify.post('/api/projects/:id/launch', handler);
  fastify.post('/api/projects/:id/infra/runtime/ensure', handler);
}
