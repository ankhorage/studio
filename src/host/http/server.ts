import {
  InfraScriptExecutionError,
  runProjectInfrastructureLifecycle,
} from '@ankhorage/infra/project';
import cors from '@fastify/cors';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import Fastify from 'fastify';

import { isAppCategory, isAppManifest } from '../../contractGuards';
import { ProjectCreationValidationError } from '../../projectIdentity';
import { stopAllProjectInfraPortForwards } from '../orchestrator/infraSession';
import { ModuleManager } from '../orchestrator/moduleManager';
import { ProjectManager } from '../orchestrator/projectManager';
import { getProjectPath } from '../orchestrator/projectPaths';
import { upProjectInfrastructure } from '../orchestrator/studioInfraUp';
import { getTemplateCatalog, type ProjectTemplateSelection } from '../templateRegistry';
import { trimOutputForApi } from '../utils/trimOutput';
import { resolveWorkspaceRoot } from '../utils/workspaceRoot';
import { registerProjectMediaRoutes } from './mediaRoutes';
import { registerProjectModuleRoutes } from './moduleRoutes';
import { registerProjectRuntimeRoutes } from './projectRuntimeRoutes';
import { isOriginAllowed } from './security';

const MAX_INFRA_RUNTIME_OUTPUT_CHARS = 12_000;

/***
 * Validate an HTTP request body as the Studio project-template category/id selection consumed by project creation.
 * @todo Keep this ProjectTemplateSelection validation with the projects/templates HTTP adapter; the AppCategory guard itself belongs to contracts.
 */
function resolveProjectTemplateSelection(body: {
  category?: unknown;
  templateId?: unknown;
}): ProjectTemplateSelection | null {
  if (typeof body.category !== 'string' || typeof body.templateId !== 'string') {
    return null;
  }

  if (!isAppCategory(body.category)) {
    return null;
  }

  return {
    category: body.category,
    templateId: body.templateId,
  };
}

/***
 * Compose the Studio Fastify host: security policy, project/template/manifest/infra routes, feature route adapters, health endpoint and shutdown cleanup.
 * @todo Keep HTTP/Fastify composition in the package-level host edge; project, deploy, manifest and module behavior should remain in their owning application/domain services.
 */
export async function createStudioHostServer(args: {
  projectManager: ProjectManager;
  orchestrator: ModuleManager;
  projectRoot: string;
  fastifyInstance?: FastifyInstance;
}) {
  const { projectManager, orchestrator, projectRoot } = args;
  const fastify = args.fastifyInstance ?? Fastify({ logger: true });

  /*** Apply Studio's local/LAN CORS origin policy to incoming browser origins. */
  await fastify.register(cors, {
    origin: (origin, cb) => {
      if (isOriginAllowed(origin)) {
        cb(null, true);
        return;
      }
      fastify.log.warn({ origin }, 'CORS origin rejected by security policy');
      cb(new Error('Not allowed'), false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  registerProjectMediaRoutes(fastify, { projectManager, workspaceRoot: projectRoot });
  registerProjectRuntimeRoutes(fastify, { projectManager, workspaceRoot: projectRoot });

  // --- PROJECT ROUTES ---

  /*** List all Studio workspace projects. */
  fastify.get('/api/projects', () => projectManager.listProjects());

  /*** Return the Studio template catalog. */
  fastify.get('/api/templates', () => getTemplateCatalog());

  /*** Create a project from a validated name/template selection and map domain validation failures to HTTP status codes. */
  fastify.post('/api/projects', async (req: FastifyRequest, reply: FastifyReply) => {
    const { name, includeStudio = true } = req.body as {
      name?: unknown;
      category?: unknown;
      templateId?: unknown;
      includeStudio?: boolean;
    };
    const templateSelection = resolveProjectTemplateSelection(req.body as Record<string, unknown>);

    if (typeof name !== 'string' || !templateSelection) {
      return reply.status(400).send({ error: 'Name, category, and templateId are required' });
    }

    try {
      const result = await projectManager.createProject(name, templateSelection, undefined, {
        includeStudio,
      });
      return result;
    } catch (err: unknown) {
      if (err instanceof ProjectCreationValidationError) {
        const status =
          err.reason.code === 'project-id-exists' || err.reason.code === 'project-name-exists'
            ? 409
            : 400;
        return reply.status(status).send(err.reason);
      }
      const message = err instanceof Error ? err.message : String(err);
      reply.status(500).send({ error: message });
    }
  });

  /*** Delete one project by route id and map host failures to an HTTP error response. */
  fastify.delete('/api/projects/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    try {
      return await projectManager.deleteProject(id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      reply.status(500).send({ error: message });
    }
  });

  /*** Synchronize one project through the module orchestrator. */
  fastify.post('/api/projects/:id/sync', async (req: FastifyRequest) => {
    const { id } = req.params as { id: string };
    const { includeStudio = true } = (req.body as { includeStudio?: boolean } | undefined) ?? {};

    return await orchestrator.syncProject({
      projectId: id,
      includeStudio,
    });
  });

  /*** Install packages required by the current Studio workspace. */
  fastify.post('/api/workspace/packages/install', async (_req: FastifyRequest, reply) => {
    try {
      await projectManager.installWorkspacePackages();
      return { success: true, scope: 'workspace' as const };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      reply.status(500).send({ error: message });
    }
  });

  /*** Regenerate one project's infrastructure artifacts. */
  fastify.post('/api/projects/:id/infra/generate', async (req: FastifyRequest, reply) => {
    const { id } = req.params as { id: string };
    try {
      return await projectManager.regenerateInfrastructure(id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      reply.status(500).send({ error: message });
    }
  });

  /*** Return generated infrastructure status for one project. */
  fastify.get('/api/projects/:id/infra/status', async (req: FastifyRequest, reply) => {
    const { id } = req.params as { id: string };
    try {
      return await projectManager.getInfrastructureStatus(id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      reply.status(500).send({ error: message });
    }
  });

  /*** Regenerate/start one project's infrastructure and expose its lifecycle result. */
  fastify.post('/api/projects/:id/infra/up', async (req: FastifyRequest, reply) => {
    const { id } = req.params as { id: string };
    try {
      const infra = await upProjectInfrastructure({
        projectId: id,
        projectManager,
        workspaceRoot: projectRoot,
      });
      return {
        success: true,
        ...infra,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      reply.status(500).send({ error: message });
    }
  });

  /*** Stop one project's generated infrastructure after resolving its active target. */
  fastify.post('/api/projects/:id/infra/down', async (req: FastifyRequest, reply) => {
    const { id } = req.params as { id: string };
    try {
      const status = await projectManager.getInfrastructureStatus(id);
      if (status.skipped) {
        return { success: true, skipped: status.skipped };
      }
      if (!status.target) {
        throw new Error(
          `Project '${id}' has no infrastructure target. Run infra generation first.`,
        );
      }

      await runProjectInfrastructureLifecycle({
        projectId: id,
        projectPath: getProjectPath(projectRoot, id),
        target: status.target,
        script: 'down',
      });

      return { success: true, target: status.target };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      reply.status(500).send({ error: message });
    }
  });

  /*** Execute one project's infrastructure runtime-status script and return bounded stdout/stderr diagnostics. */
  fastify.post('/api/projects/:id/infra/runtime-status', async (req: FastifyRequest, reply) => {
    const { id } = req.params as { id: string };
    try {
      const status = await projectManager.getInfrastructureStatus(id);
      if (status.skipped) {
        return { success: true, skipped: status.skipped };
      }
      if (!status.target) {
        throw new Error(
          `Project '${id}' has no infrastructure target. Run infra generation first.`,
        );
      }

      const runtimeOutput = await runProjectInfrastructureLifecycle({
        projectId: id,
        projectPath: getProjectPath(projectRoot, id),
        target: status.target,
        script: 'status',
      });
      const responseOutput = formatRuntimeOutputForResponse(runtimeOutput);

      fastify.log.info(
        {
          projectId: id,
          target: status.target,
          script: 'status',
          exitCode: 0,
          stdout: runtimeOutput.stdout,
          stderr: runtimeOutput.stderr,
        },
        'Infra runtime-status executed',
      );

      return {
        success: true,
        target: status.target,
        stdout: responseOutput.stdout,
        stderr: responseOutput.stderr,
        stdoutTruncated: responseOutput.stdoutTruncated,
        stderrTruncated: responseOutput.stderrTruncated,
        stdoutLength: responseOutput.stdoutLength,
        stderrLength: responseOutput.stderrLength,
      };
    } catch (err: unknown) {
      if (err instanceof InfraScriptExecutionError) {
        const responseOutput = formatRuntimeOutputForResponse({
          stdout: err.stdout,
          stderr: err.stderr,
        });

        fastify.log.error(
          {
            projectId: id,
            script: 'status',
            exitCode: err.exitCode,
            stdout: err.stdout,
            stderr: err.stderr,
          },
          'Infra runtime-status failed',
        );

        return reply.status(500).send({
          error: err.message,
          exitCode: err.exitCode,
          stdout: responseOutput.stdout,
          stderr: responseOutput.stderr,
          stdoutTruncated: responseOutput.stdoutTruncated,
          stderrTruncated: responseOutput.stderrTruncated,
          stdoutLength: responseOutput.stdoutLength,
          stderrLength: responseOutput.stderrLength,
        });
      }
      const message = err instanceof Error ? err.message : String(err);
      reply.status(500).send({ error: message });
    }
  });

  /*** Synchronize generated runtime files for one project. */
  fastify.post(
    '/api/projects/:id/runtime/sync',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string };
      try {
        return await orchestrator.syncProjectRuntime(id);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        reply.status(500).send({ error: message });
      }
    },
  );

  /*** Return one project manifest, optionally finalizing pending module operations first. */
  fastify.get('/api/projects/:id/manifest', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { finalize } = req.query as { finalize?: string };

    try {
      if (finalize === 'true') {
        await orchestrator.applyPendingOperations(id);
      }

      return await projectManager.getProjectManifest(id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      reply.status(404).send({ error: message });
    }
  });

  /*** Validate and persist one project manifest through the orchestrator. */
  fastify.put('/api/projects/:id/manifest', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    if (!isAppManifest(req.body)) {
      return reply.status(400).send({ error: 'Manifest body required' });
    }

    try {
      return await orchestrator.persistProjectManifest({
        projectId: id,
        manifest: req.body,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      reply.status(500).send({ error: message });
    }
  });

  registerProjectModuleRoutes(fastify, orchestrator);

  /*** Return basic host health and workspace identity. */
  fastify.get('/health', () => ({ status: 'ok', workspace: projectRoot }));

  /*** Stop all project infrastructure port forwards when the Studio host closes. */
  fastify.addHook('onClose', async () => {
    await stopAllProjectInfraPortForwards();
  });

  return fastify;
}

export interface StartStudioHostServerOptions {
  readonly host?: string;
  readonly port?: number;
  readonly projectRoot?: string;
}

/***
 * Construct Studio host managers, create the Fastify server, listen on resolved host/port options, and return the running instance.
 * @todo Keep this concrete server lifecycle in the package-level host edge.
 */
export async function startStudioHostServer(options: number | StartStudioHostServerOptions = {}) {
  const resolvedOptions = typeof options === 'number' ? { port: options } : options;
  const projectRoot = resolvedOptions.projectRoot ?? resolveWorkspaceRoot(import.meta.dirname);
  const orchestrator = new ModuleManager(projectRoot);
  const projectManager = new ProjectManager(projectRoot);
  const fastify = await createStudioHostServer({ projectManager, orchestrator, projectRoot });
  const port = resolvedOptions.port ?? 3000;
  const host = resolvedOptions.host ?? '127.0.0.1';

  await fastify.listen({ port, host });
  console.log(`Ankhorage Studio Host running at http://${host}:${port}`);
  return fastify;
}

/***
 * Trim stdout/stderr independently and project their text, truncation flags and original lengths into an API-safe response shape.
 * @utility @ankhorage/utility/process/output
 */
function formatRuntimeOutputForResponse(output: { stdout: string; stderr: string }) {
  const stdout = trimOutputForApi(output.stdout, MAX_INFRA_RUNTIME_OUTPUT_CHARS);
  const stderr = trimOutputForApi(output.stderr, MAX_INFRA_RUNTIME_OUTPUT_CHARS);

  return {
    stdout: stdout.text,
    stderr: stderr.text,
    stdoutTruncated: stdout.truncated,
    stderrTruncated: stderr.truncated,
    stdoutLength: stdout.originalLength,
    stderrLength: stderr.originalLength,
  };
}
