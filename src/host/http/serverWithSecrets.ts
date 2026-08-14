import { ModuleManager } from '../orchestrator/moduleManager';
import { ProjectManager } from '../orchestrator/projectManager';
import { resolveWorkspaceRoot } from '../utils/workspaceRoot';
import { registerProjectAuthRoutes } from './authRoutes';
import { registerProjectDataSourceRoutes } from './dataSourceRoutes';
import { registerProjectDeployRoutes } from './deployRoutes';
import { registerProjectSecretRoutes } from './secretRoutes';
import { createStudioHostServer, type StartStudioHostServerOptions } from './server';

/**
 * Starts the Studio host with trusted auth, secret, and data-source bridges registered.
 */
export async function startStudioHostServerWithSecrets(
  options: number | StartStudioHostServerOptions = {},
) {
  const resolvedOptions = typeof options === 'number' ? { port: options } : options;
  const projectRoot = resolvedOptions.projectRoot ?? resolveWorkspaceRoot(import.meta.dirname);
  const orchestrator = new ModuleManager(projectRoot);
  const projectManager = new ProjectManager(projectRoot);
  const fastify = await createStudioHostServer({ projectManager, orchestrator, projectRoot });

  registerProjectAuthRoutes(fastify, { projectManager, workspaceRoot: projectRoot });
  registerProjectSecretRoutes(fastify, { projectManager, workspaceRoot: projectRoot });
  registerProjectDataSourceRoutes(fastify, { projectManager, workspaceRoot: projectRoot });
  registerProjectDeployRoutes(fastify, { projectManager, workspaceRoot: projectRoot });

  const port = resolvedOptions.port ?? 3000;
  const host = resolvedOptions.host ?? '127.0.0.1';
  await fastify.listen({ port, host });
  console.log(`Ankhorage Studio Host running at http://${host}:${port}`);
  return fastify;
}
