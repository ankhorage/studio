import { ModuleManager } from '../orchestrator/moduleManager';
import { ProjectManager } from '../orchestrator/projectManager';
import { resolveWorkspaceRoot } from '../utils/workspaceRoot';
import { createStudioHostServer, type StartStudioHostServerOptions } from './server';
import { registerProjectSecretRoutes } from './secretRoutes';

/**
 * Starts the Studio host with the Phase 2 metadata-only secret bridge registered.
 */
export async function startStudioHostServerWithSecrets(
  options: number | StartStudioHostServerOptions = {},
) {
  const resolvedOptions = typeof options === 'number' ? { port: options } : options;
  const projectRoot = resolvedOptions.projectRoot ?? resolveWorkspaceRoot(import.meta.dirname);
  const orchestrator = new ModuleManager(projectRoot);
  const projectManager = new ProjectManager(projectRoot);
  const fastify = await createStudioHostServer({ projectManager, orchestrator, projectRoot });

  registerProjectSecretRoutes(fastify, {
    projectManager,
    workspaceRoot: projectRoot,
  });

  const port = resolvedOptions.port ?? 3000;
  const host = resolvedOptions.host ?? '127.0.0.1';
  await fastify.listen({ port, host });
  console.log(`Ankhorage Studio Host running at http://${host}:${port}`);
  return fastify;
}
