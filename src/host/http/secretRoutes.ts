import type { SecretPayload, SecretStoreResult } from '@ankhorage/contracts/secrets';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { ProjectManager } from '../orchestrator/projectManager';
import { ProjectSecretService } from '../secrets/projectSecretService';

export function registerProjectSecretRoutes(
  fastify: FastifyInstance,
  options: {
    readonly projectManager: ProjectManager;
    readonly workspaceRoot: string;
  },
): void {
  const service = new ProjectSecretService(options);

  fastify.get('/api/projects/:id/secrets', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as {
      environment?: string;
      kind?: string;
      provider?: string;
    };

    return sendSecretResult(
      reply,
      await service.list({
        projectId: id,
        environment: query.environment,
        kind: query.kind,
        provider: query.provider,
      }),
    );
  });

  fastify.get('/api/projects/:id/secrets/metadata', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { environment?: string; ref?: unknown };
    if (typeof query.ref !== 'string' || query.ref.trim().length === 0) {
      return reply.status(400).send({
        error: { code: 'invalid_reference', message: 'A secret ref query parameter is required.' },
      });
    }

    return sendSecretResult(
      reply,
      await service.getMetadata({
        projectId: id,
        environment: query.environment,
        ref: query.ref,
      }),
    );
  });

  fastify.get('/api/projects/:id/secrets/usages', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { environment?: string; ref?: unknown };
    if (typeof query.ref !== 'string' || query.ref.trim().length === 0) {
      return reply.status(400).send({
        ok: false,
        error: { code: 'invalid_reference', message: 'A secret ref query parameter is required.' },
      });
    }

    try {
      return {
        ok: true,
        data: await service.getUsages({
          projectId: id,
          environment: query.environment,
          ref: query.ref,
        }),
      };
    } catch {
      return reply.status(500).send({
        ok: false,
        error: {
          code: 'manifest_read_failed',
          message: 'The project manifest could not be loaded for secret usage analysis.',
        },
      });
    }
  });

  fastify.post('/api/projects/:id/secrets', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };
    const body = asRecord(request.body);
    const payload = readSecretPayload(body.payload);
    if (!payload || typeof body.ref !== 'string' || typeof body.kind !== 'string') {
      return reply.status(400).send({
        error: {
          code: 'invalid_payload',
          message: 'Secret creation requires ref, kind, and a non-empty string payload object.',
        },
      });
    }

    return sendSecretResult(
      reply,
      await service.create({
        projectId: id,
        environment: readOptionalString(body.environment),
        ref: body.ref,
        kind: body.kind,
        provider: readOptionalString(body.provider),
        payload,
      }),
    );
  });

  fastify.put('/api/projects/:id/secrets', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };
    const body = asRecord(request.body);
    const payload = readSecretPayload(body.payload);
    if (!payload || typeof body.ref !== 'string') {
      return reply.status(400).send({
        error: {
          code: 'invalid_payload',
          message:
            'Secret replacement requires ref and a complete non-empty string payload object.',
        },
      });
    }

    return sendSecretResult(
      reply,
      await service.replace({
        projectId: id,
        environment: readOptionalString(body.environment),
        ref: body.ref,
        payload,
      }),
    );
  });

  fastify.delete('/api/projects/:id/secrets', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as {
      environment?: string;
      ref?: unknown;
      confirmBrokenReferences?: unknown;
    };
    if (typeof query.ref !== 'string' || query.ref.trim().length === 0) {
      return reply.status(400).send({
        error: { code: 'invalid_reference', message: 'A secret ref query parameter is required.' },
      });
    }

    return sendSecretRemoveResult(
      reply,
      await service.removeGuarded({
        projectId: id,
        environment: query.environment,
        ref: query.ref,
        confirmBrokenReferences: query.confirmBrokenReferences === 'true',
      }),
    );
  });

  fastify.post(
    '/api/projects/:id/auth/oauth/:providerId',
    async (request: FastifyRequest, reply) => {
      const { id, providerId } = request.params as { id: string; providerId: string };
      const body = asRecord(request.body);
      const payload = readSecretPayload(body.payload);
      if (!payload) {
        return reply.status(400).send({
          error: {
            code: 'invalid_payload',
            message: 'OAuth configuration requires a complete non-empty credential payload.',
          },
        });
      }

      const result = await service.configureOAuthProvider({
        projectId: id,
        providerId,
        payload,
        environment: readOptionalString(body.environment),
        credentialsRef: readOptionalString(body.credentialsRef),
        enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
        label: readOptionalString(body.label),
        scopes: readStringArray(body.scopes),
        callbackRoute: readOptionalString(body.callbackRoute),
      });

      if (!result.ok) {
        const status = result.state === 'secret_saved_manifest_failed' ? 409 : 400;
        return reply.status(status).send(result);
      }

      return result;
    },
  );
}

function sendSecretResult<TData>(reply: FastifyReply, result: SecretStoreResult<TData>) {
  if (result.ok) return result;

  const status = resolveErrorStatus(result.error.code);
  return reply.status(status).send({
    ok: false,
    error: {
      code: result.error.code,
      message: result.error.message,
    },
  });
}

function sendSecretRemoveResult(
  reply: FastifyReply,
  result: Awaited<ReturnType<ProjectSecretService['removeGuarded']>>,
) {
  if (result.ok) return result;

  const status =
    result.error.code === 'secret_in_use' ? 409 : resolveErrorStatus(result.error.code);
  return reply.status(status).send({
    ok: false,
    error: {
      code: result.error.code,
      message: result.error.message,
    },
    ...(result.data ? { data: result.data } : {}),
  });
}

function resolveErrorStatus(code: string): number {
  if (code === 'not_found') return 404;
  if (code === 'conflict') return 409;
  if (code === 'permission_denied') return 403;
  if (code === 'unavailable' || code === 'provider_error') return 503;
  return 400;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const result: string[] = [];
  for (const item of value as readonly unknown[]) {
    if (typeof item !== 'string') return undefined;
    const normalized = item.trim();
    if (normalized) result.push(normalized);
  }

  return result;
}

function readSecretPayload(value: unknown): SecretPayload | null {
  const record = asRecord(value);
  const entries = Object.entries(record);
  if (
    entries.length === 0 ||
    entries.some(
      ([field, fieldValue]) => !field.trim() || typeof fieldValue !== 'string' || !fieldValue,
    )
  ) {
    return null;
  }

  return Object.freeze(Object.fromEntries(entries) as Record<string, string>);
}
