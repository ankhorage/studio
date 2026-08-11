import type { FastifyInstance } from 'fastify';

import type { ModuleManager } from '../orchestrator/moduleManager';

type ProjectModuleRouteManager = Pick<
  ModuleManager,
  | 'applyPendingOperations'
  | 'executeModuleAdminOperation'
  | 'getModuleState'
  | 'installModule'
  | 'listModules'
  | 'uninstallModule'
  | 'updateModuleConfig'
>;

interface ProjectParams {
  readonly id: string;
}

interface ProjectModuleParams extends ProjectParams {
  readonly moduleId: string;
}

interface ProjectModuleAdminParams extends ProjectModuleParams {
  readonly operation: string;
}

export function registerProjectModuleRoutes(
  fastify: FastifyInstance,
  orchestrator: ProjectModuleRouteManager,
): void {
  fastify.post<{ Params: ProjectParams }>(
    '/api/projects/:id/modules/finalize-pending',
    async (req, reply) => {
      try {
        return await orchestrator.applyPendingOperations(req.params.id);
      } catch (error: unknown) {
        return reply.status(500).send({ error: toMessage(error) });
      }
    },
  );

  fastify.get<{ Params: ProjectParams }>('/api/projects/:id/modules', async (req, reply) => {
    try {
      return await orchestrator.listModules(req.params.id);
    } catch (error: unknown) {
      return reply.status(500).send({ error: toMessage(error) });
    }
  });

  fastify.get<{ Params: ProjectModuleParams }>(
    '/api/projects/:id/modules/:moduleId',
    async (req, reply) => {
      try {
        const moduleState = await orchestrator.getModuleState(req.params.id, req.params.moduleId);
        if (!moduleState) return reply.status(404).send({ error: 'Module not found' });
        return moduleState;
      } catch (error: unknown) {
        return reply.status(500).send({ error: toMessage(error) });
      }
    },
  );

  fastify.post<{ Params: ProjectModuleParams; Body: unknown }>(
    '/api/projects/:id/modules/:moduleId/install',
    async (req, reply) => {
      const config = isRecord(req.body) ? req.body.config : undefined;
      try {
        return await orchestrator.installModule(req.params.id, req.params.moduleId, config);
      } catch (error: unknown) {
        return reply.status(400).send({ error: toMessage(error) });
      }
    },
  );

  fastify.post<{ Params: ProjectModuleParams }>(
    '/api/projects/:id/modules/:moduleId/uninstall',
    async (req, reply) => {
      try {
        return await orchestrator.uninstallModule(req.params.id, req.params.moduleId);
      } catch (error: unknown) {
        return reply.status(400).send({ error: toMessage(error) });
      }
    },
  );

  fastify.put<{ Params: ProjectModuleParams; Body: unknown }>(
    '/api/projects/:id/modules/:moduleId/config',
    async (req, reply) => {
      if (!isRecord(req.body) || req.body.config === undefined) {
        return reply.status(400).send({ error: 'config body required' });
      }

      try {
        return await orchestrator.updateModuleConfig(
          req.params.id,
          req.params.moduleId,
          req.body.config,
        );
      } catch (error: unknown) {
        return reply.status(400).send({ error: toMessage(error) });
      }
    },
  );

  fastify.post<{ Params: ProjectModuleAdminParams; Body: unknown }>(
    '/api/projects/:id/modules/:moduleId/admin/:operation',
    async (req, reply) => {
      if (req.body !== undefined && !isRecord(req.body)) {
        return reply.status(400).send({ error: 'admin operation body must be an object' });
      }

      const body = isRecord(req.body) ? req.body : {};
      try {
        return await orchestrator.executeModuleAdminOperation(req.params.id, req.params.moduleId, {
          operation: req.params.operation,
          ...(body.input === undefined ? {} : { input: body.input }),
          ...(body.componentMeta === undefined ? {} : { componentMeta: body.componentMeta }),
        });
      } catch (error: unknown) {
        return reply.status(400).send({ error: toMessage(error) });
      }
    },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
