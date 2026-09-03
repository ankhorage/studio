import type { SecretPayload, SecretStoreResult } from '@ankhorage/contracts/secrets';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { ProjectManager } from '../orchestrator/projectManager';
import { ProjectSecretService, ProjectSecretUsageError } from '../secrets/projectSecretService';

/*** Register Studio secret metadata/usage/create/replace/remove and OAuth-credential HTTP adapters. */
export function registerProjectSecretRoutes(
  fastify: FastifyInstance,
  options: {
    readonly projectManager: ProjectManager;
    readonly workspaceRoot: string;
  },
): void {
  const service = new ProjectSecretService(options);

  /*** List project secret metadata using optional environment/kind/provider filters. */
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

  /*** Return metadata for one required secret reference. */
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

  /*** Analyze usages of one required secret reference and map usage/domain failures to structured HTTP errors. */
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
    } catch (error) {
      const invalidReference = error instanceof ProjectSecretUsageError;
      return reply.status(invalidReference ? 400 : 500).send({
        ok: false,
        error: {
          code: invalidReference ? error.code : 'manifest_read_failed',
          message: invalidReference
            ? error.message
            : 'The project manifest could not be loaded for secret usage analysis.',
        },
      });
    }
  });

  /*** Validate and create one project secret payload. */
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

  /*** Validate and replace one complete project secret payload. */
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

  /*** Remove one project secret through the guarded usage-aware removal service. */
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

  /*** Configure one OAuth provider credential payload through the project secret service. */
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
      });

      if (!result.ok) {
        return reply.status(400).send(result);
      }

      return result;
    },
  );
}

/*** Translate one SecretStoreResult into the Studio HTTP status/error envelope while preserving successful results. */
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

/*** Translate guarded secret-removal failures, including in-use conflict data, into the Studio HTTP envelope. */
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

/***
 * Map secret-store error codes to HTTP status semantics.
 * @todo Keep this mapping beside the SecretStoreResult/error-code contract rather than generic Utility.
 */
function resolveErrorStatus(code: string): number {
  if (code === 'not_found') return 404;
  if (code === 'conflict') return 409;
  if (code === 'permission_denied') return 403;
  if (code === 'unavailable' || code === 'provider_error') return 503;
  return 400;
}

/***
 * Convert an unknown value to a record, falling back to an empty record.
 * @utility @ankhorage/utility/object
 */
function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/***
 * Read a trimmed non-empty string from an unknown value.
 * @utility @ankhorage/utility/string
 */
function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

/***
 * Parse a non-empty record whose keys and values are non-empty strings and freeze the resulting string record.
 * @utility @ankhorage/utility/validation
 */
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
