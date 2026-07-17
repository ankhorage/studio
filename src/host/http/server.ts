import type { AppCategory, AppManifest } from '@ankhorage/contracts';
import cors from '@fastify/cors';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import Fastify from 'fastify';
import { promises as fs } from 'fs';
import path from 'path';

import {
  ensureProjectInfraPortForward,
  InfraScriptExecutionError,
  runProjectInfraScript,
  runProjectInfraScriptCapture,
  stopAllProjectInfraPortForwards,
} from '../orchestrator/infraRuntime';
import { ModuleManager } from '../orchestrator/moduleManager';
import { ProjectManager } from '../orchestrator/projectManager';
import { resolveModuleLayoutMutations } from '../orchestrator/resolveMutations';
import { upProjectInfrastructure } from '../orchestrator/studioInfraUp';
import { getTemplateSummaries, type ProjectTemplateSelection } from '../templateRegistry';
import { trimOutputForApi } from '../utils/trimOutput';
import { resolveWorkspaceRoot } from '../utils/workspaceRoot';
import { isOriginAllowed } from './security';

const MAX_INFRA_RUNTIME_OUTPUT_CHARS = 12_000;

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readSimpleEnvMap(filePath: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!(await exists(filePath))) return out;

  const content = await fs.readFile(filePath, 'utf8');
  const lines = content.split(/\r?\n/u);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed
      .slice(idx + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
    out.set(key, value);
  }

  return out;
}

function readFirstEnvValue(env: Map<string, string>, keys: string[]): string | null {
  for (const key of keys) {
    const value = env.get(key);
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function resolveProjectTemplateSelection(body: {
  category?: unknown;
  templateId?: unknown;
}): ProjectTemplateSelection | null {
  if (typeof body.category !== 'string' || typeof body.templateId !== 'string') {
    return null;
  }

  return {
    category: body.category as AppCategory,
    templateId: body.templateId,
  };
}

export async function createStudioHostServer(args: {
  projectManager: ProjectManager;
  orchestrator: ModuleManager;
  projectRoot: string;
  fastifyInstance?: FastifyInstance;
}) {
  const { projectManager, orchestrator, projectRoot } = args;
  const fastify = args.fastifyInstance ?? Fastify({ logger: true });

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

  // --- PROJECT ROUTES ---

  fastify.get('/api/projects', () => projectManager.listProjects());

  fastify.get('/api/templates', () => getTemplateSummaries());

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
      const result = await projectManager.createProject(
        name,
        templateSelection,
        (id) => orchestrator.generateModuleRegistry(id),
        { includeStudio },
      );
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      reply.status(500).send({ error: message });
    }
  });

  fastify.delete('/api/projects/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    try {
      return await projectManager.deleteProject(id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      reply.status(500).send({ error: message });
    }
  });

  fastify.post('/api/projects/:id/sync', async (req: FastifyRequest) => {
    const { id } = req.params as { id: string };
    const { includeStudio = true } = (req.body as { includeStudio?: boolean } | undefined) ?? {};

    return await orchestrator.syncProject({
      projectId: id,
      includeStudio,
    });
  });

  fastify.post('/api/workspace/packages/install', async (_req: FastifyRequest, reply) => {
    try {
      await projectManager.installWorkspacePackages();
      return { success: true, scope: 'workspace' as const };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      reply.status(500).send({ error: message });
    }
  });

  fastify.post('/api/projects/:id/infra/generate', async (req: FastifyRequest, reply) => {
    const { id } = req.params as { id: string };
    try {
      return await projectManager.regenerateInfrastructure(id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      reply.status(500).send({ error: message });
    }
  });

  fastify.get('/api/projects/:id/infra/status', async (req: FastifyRequest, reply) => {
    const { id } = req.params as { id: string };
    try {
      return await projectManager.getInfrastructureStatus(id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      reply.status(500).send({ error: message });
    }
  });

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

      await runProjectInfraScript({
        rootPath: projectRoot,
        projectId: id,
        target: status.target,
        script: 'down',
      });

      return { success: true, target: status.target };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      reply.status(500).send({ error: message });
    }
  });

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

      const runtimeOutput = await runProjectInfraScriptCapture({
        rootPath: projectRoot,
        projectId: id,
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

  fastify.post('/api/projects/:id/launch', async (req: FastifyRequest, reply) => {
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

      const portForward = await ensureProjectInfraPortForward({
        rootPath: projectRoot,
        projectId: id,
        target: status.target,
      });

      return {
        success: true,
        target: status.target,
        url: portForward.url,
        started: portForward.started,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      reply.status(500).send({ error: message });
    }
  });

  // GET studio manifest draft
  fastify.get(
    '/api/projects/:id/studio/manifest',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string };

      try {
        return await projectManager.getStudioManifest(id);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        reply.status(404).send({ error: message });
      }
    },
  );

  // PUT studio manifest draft
  fastify.put(
    '/api/projects/:id/studio/manifest',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string };
      const manifest = req.body as AppManifest | null;

      if (!manifest) {
        return reply.status(400).send({ error: 'Manifest body required' });
      }

      try {
        return await projectManager.saveStudioManifest({
          projectId: id,
          manifest,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        reply.status(500).send({ error: message });
      }
    },
  );

  fastify.put(
    '/api/projects/:id/studio/runtime',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string };
      const manifest = req.body as AppManifest | null;

      if (!manifest) {
        return reply.status(400).send({ error: 'Manifest body required' });
      }

      try {
        return await projectManager.syncStudioRuntime({
          projectId: id,
          manifest,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        reply.status(500).send({ error: message });
      }
    },
  );

  // GET manifest
  fastify.get('/api/projects/:id/manifest', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { finalize } = req.query as { finalize?: string };

    try {
      // Apply pending operations ONLY if explicitly requested via query param.
      // In normal Studio dev mode, we should NOT call this to avoid Metro crashes.
      if (finalize === 'true') {
        await orchestrator.applyPendingOperations(id);
      }

      const manifest = await projectManager.getProjectManifest(id);
      // Ensure registry exists for this project (self-healing)
      await orchestrator.generateModuleRegistry(id);
      return manifest;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      reply.status(404).send({ error: message });
    }
  });

  // GET project-scoped Supabase public credentials for Studio uploads
  fastify.get(
    '/api/projects/:id/infra/storage/supabase-public',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string };

      try {
        const status = await projectManager.getInfrastructureStatus(id);
        const { target } = status;
        if (!target) {
          return reply.status(400).send({
            error: `Project '${id}' has no infra deployment target configured. Run infra generation first.`,
          });
        }

        const infraRoot = path.join(projectRoot, 'apps', id, 'infra', target);
        const envPath = path.join(infraRoot, '.env');
        const fallbackEnvPath = path.join(infraRoot, '.env.example');

        const envMap = await readSimpleEnvMap((await exists(envPath)) ? envPath : fallbackEnvPath);

        const url =
          readFirstEnvValue(envMap, ['EXPO_PUBLIC_SUPABASE_URL']) ??
          readFirstEnvValue(envMap, ['SUPABASE_URL']);
        const anonKey =
          readFirstEnvValue(envMap, ['EXPO_PUBLIC_SUPABASE_ANON_KEY']) ??
          readFirstEnvValue(envMap, ['SUPABASE_ANON_KEY']);

        if (!url || !anonKey) {
          return reply.status(400).send({
            error:
              `Missing Supabase public credentials for project '${id}'. ` +
              `Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in ${envPath} (or regenerate infra).`,
          });
        }

        return { url, anonKey };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        reply.status(500).send({ error: message });
      }
    },
  );

  fastify.post(
    '/api/projects/:id/modules/finalize-pending',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string };
      try {
        return await orchestrator.applyPendingOperations(id);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        reply.status(500).send({ error: message });
      }
    },
  );

  // PUT (Save) Manifest
  fastify.put('/api/projects/:id/manifest', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const manifest = req.body as AppManifest | null;

    if (!manifest) {
      return reply.status(400).send({ error: 'Manifest body required' });
    }

    try {
      const activeModules = manifest.infra.plugins;
      const mutations = resolveModuleLayoutMutations(activeModules);

      return await projectManager.saveProjectManifest({
        projectId: id,
        manifest,
        mutations,
        regenerateRouterFiles: true,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      reply.status(500).send({ error: message });
    }
  });

  // --- LOCALIZATION ROUTES ---

  fastify.get('/api/projects/:id/localization/locales', async (req: FastifyRequest) => {
    const { id } = req.params as { id: string };
    return await projectManager.getLocalizationLocales(id);
  });

  fastify.get(
    '/api/projects/:id/localization/locales/:locale',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id, locale } = req.params as { id: string; locale: string };
      try {
        return await projectManager.getLocalizationLocale(id, locale);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        reply.status(404).send({ error: message });
      }
    },
  );

  fastify.put(
    '/api/projects/:id/localization/locales/:locale',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id, locale } = req.params as { id: string; locale: string };
      const dict = req.body as Record<string, string> | null;

      if (!dict || typeof dict !== 'object' || Array.isArray(dict)) {
        return reply.status(400).send({ error: 'Dictionary object required' });
      }

      // Basic validation: all values must be strings
      for (const [k, v] of Object.entries(dict)) {
        if (typeof v !== 'string') {
          return reply
            .status(400)
            .send({ error: `Invalid value for key "${k}": must be a string` });
        }
      }

      // Locale format validation (sync with ProjectManager)
      if (!/^[a-z]{2,3}([-_][a-zA-Z0-9]+)*$/.test(locale)) {
        return reply.status(400).send({ error: `Invalid locale format: ${locale}` });
      }

      try {
        return await projectManager.saveLocalizationLocale(id, locale, dict);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        reply.status(500).send({ error: message });
      }
    },
  );

  // --- MODULE ROUTES ---

  fastify.get('/api/modules/available', () => orchestrator.getAvailableModules());

  fastify.get(
    '/api/modules/:moduleId/proxy/*',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { moduleId } = req.params as { moduleId: string };
      const path = (req.params as { '*'?: string })['*'] ?? '';
      const query = req.query as Record<string, string>;

      const queryString = new URLSearchParams(query).toString();
      const fullPath = `/${path}${queryString ? `?${queryString}` : ''}`;

      try {
        return await orchestrator.proxyGet(moduleId, fullPath);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        reply.status(500).send({ error: message });
      }
    },
  );

  fastify.post('/api/modules/install', async (req: FastifyRequest, reply: FastifyReply) => {
    const { projectId, moduleId, config } = req.body as {
      projectId: string;
      moduleId: string;
      config?: Record<string, unknown>;
    };

    if (!projectId) return reply.status(400).send({ error: 'projectId required' });

    try {
      return await orchestrator.installModule(projectId, moduleId, config);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      reply.status(500).send({ error: message });
    }
  });

  fastify.post('/api/modules/uninstall', async (req: FastifyRequest, reply: FastifyReply) => {
    const { projectId, moduleId } = req.body as { projectId: string; moduleId: string };
    try {
      return await orchestrator.uninstallModule(projectId, moduleId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      reply.status(500).send({ error: message });
    }
  });

  fastify.post(
    '/api/projects/:id/modules/:moduleId/config',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id, moduleId } = req.params as { id: string; moduleId: string };
      const body = req.body as { config?: Record<string, unknown> };

      if (!body.config) return reply.status(400).send({ error: 'config body required' });

      try {
        return await orchestrator.updateModuleConfig(id, moduleId, body.config);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        reply.status(500).send({ error: message });
      }
    },
  );

  // Health check
  fastify.get('/health', () => ({ status: 'ok', workspace: projectRoot }));

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
