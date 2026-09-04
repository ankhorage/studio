import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import {
  ensureProjectInfrastructureRuntimeSession,
  ensureProjectWebLaunchSession,
  type InfraSessionDependencies,
} from '../orchestrator/infraSession';
import type { ProjectManager } from '../orchestrator/projectManager';
import { getProjectPath } from '../orchestrator/projectPaths';

type ProjectRuntimeManager = Pick<ProjectManager, 'getInfrastructureStatus'>;

/*** Register Studio project-launch and infrastructure-runtime ensure HTTP adapters. */
export function registerProjectRuntimeRoutes(
  fastify: FastifyInstance,
  options: {
    readonly projectManager: ProjectRuntimeManager;
    readonly workspaceRoot: string;
    readonly dependencies?: InfraSessionDependencies;
  },
): void {
  /*** Ensure/open the project's web launch session and return its URL/start state. */
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

  /*** Ensure the project's infrastructure runtime session is active. */
  fastify.post('/api/projects/:id/infra/runtime/ensure', (request, reply) =>
    handleProjectRuntimeRequest(request, reply, options, async ({ args, target }) => {
      await ensureProjectInfrastructureRuntimeSession(args, options.dependencies);
      return { success: true, target };
    }),
  );
}

/***
 * Resolve project runtime target/path context, honor skipped projects, execute an injected runtime action, and translate failures to HTTP 500.
 * @todo Keep this project/infra runtime orchestration in the deploy/runtime application owner rather than extracting it as a generic HTTP helper.
 */
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
