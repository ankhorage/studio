import type { DataContractValue, DataOperationIntent } from '@ankhorage/contracts/data';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type {
  ExternalApiConnectRequest,
  ExternalApiOperationTestRequest,
  ManualRestApiRequest,
} from '../../externalApiAuthoringContracts';
import { StudioExternalApiService } from '../apis/studioExternalApiService';
import type { ProjectManager } from '../orchestrator/projectManager';
import { ProjectSecretService } from '../secrets/projectSecretService';

/***
 * Register Studio external-API connect/manual/test HTTP adapters around the external API service.
 * @todo Keep this Fastify adapter at the host edge while moving reusable parsing/response primitives to their shared owners.
 */
export function registerProjectApiRoutes(
  fastify: FastifyInstance,
  options: {
    readonly projectManager: ProjectManager;
    readonly workspaceRoot: string;
    readonly service?: StudioExternalApiService;
  },
): void {
  const service =
    options.service ??
    new StudioExternalApiService({
      projectManager: options.projectManager,
      secretService: new ProjectSecretService({
        projectManager: options.projectManager,
        workspaceRoot: options.workspaceRoot,
      }),
    });

  /*** Validate and execute an external API discovery/connect request. */
  fastify.post('/api/projects/:id/apis/connect', async (request, reply) => {
    const body = readConnectRequest(request.body);
    if (!body) return invalidPayload(reply, 'External API connection payload is invalid.');
    return sendResult(reply, await service.connect(readProjectId(request), body));
  });

  /*** Validate and create a manually described REST API. */
  fastify.post('/api/projects/:id/apis/manual-rest', async (request, reply) => {
    const body = readManualRestRequest(request.body);
    if (!body) return invalidPayload(reply, 'Manual REST API payload is invalid.');
    return sendResult(reply, await service.createManualRest(readProjectId(request), body));
  });

  /*** Validate and execute one authored external API operation test. */
  fastify.post('/api/projects/:id/apis/test', async (request, reply) => {
    const body = readOperationTestRequest(request.body);
    if (!body) return invalidPayload(reply, 'API operation test payload is invalid.');
    return sendResult(reply, await service.testOperation(readProjectId(request), body));
  });
}

/***
 * Read one named string route parameter from a Fastify request params object.
 * @utility @ankhorage/utility/http/fastify
 */
function readProjectId(request: FastifyRequest): string {
  return (request.params as { readonly id: string }).id;
}

/***
 * Return a successful `{ok}` result directly or send failed results with a configurable semantic HTTP status.
 * @utility @ankhorage/utility/http/fastify
 */
function sendResult(reply: FastifyReply, result: { readonly ok: boolean }) {
  return result.ok ? result : reply.status(422).send(result);
}

/*** Build the external-API domain's canonical invalid-payload diagnostic response. */
function invalidPayload(reply: FastifyReply, message: string) {
  return reply.status(400).send({
    ok: false,
    diagnostics: [{ code: 'invalid-config', message, severity: 'error' }],
  });
}

/*** Parse an unknown connect payload into the external-API authoring contract. */
function readConnectRequest(value: unknown): ExternalApiConnectRequest | null {
  const record = readRecord(value);
  const protocol = record?.protocol;
  if (
    !record ||
    typeof record.apiId !== 'string' ||
    typeof record.url !== 'string' ||
    (protocol !== 'auto' && protocol !== 'graphql' && protocol !== 'openapi')
  ) {
    return null;
  }
  return {
    apiId: record.apiId,
    url: record.url,
    protocol,
    name: readString(record.name),
    description: readString(record.description),
    credential: readCredential(record.credential),
  };
}

/*** Parse an unknown manual REST payload into the external-API authoring contract. */
function readManualRestRequest(value: unknown): ManualRestApiRequest | null {
  const record = readRecord(value);
  if (
    !record ||
    typeof record.apiId !== 'string' ||
    typeof record.baseUrl !== 'string' ||
    typeof record.endpointId !== 'string' ||
    typeof record.path !== 'string' ||
    typeof record.operationId !== 'string' ||
    typeof record.method !== 'string' ||
    !isIntent(record.intent)
  ) {
    return null;
  }
  return {
    apiId: record.apiId,
    baseUrl: record.baseUrl,
    endpointId: record.endpointId,
    path: record.path,
    operationId: record.operationId,
    method: record.method,
    intent: record.intent,
    name: readString(record.name),
    description: readString(record.description),
    credential: readCredential(record.credential),
  };
}

/*** Parse an unknown operation-test payload into the external-API authoring contract. */
function readOperationTestRequest(value: unknown): ExternalApiOperationTestRequest | null {
  const record = readRecord(value);
  if (
    !record ||
    typeof record.apiId !== 'string' ||
    typeof record.endpointId !== 'string' ||
    typeof record.operationId !== 'string'
  ) {
    return null;
  }
  const values = readDataValues(record.values);
  if (record.values !== undefined && values === undefined) return null;
  return {
    apiId: record.apiId,
    endpointId: record.endpointId,
    operationId: record.operationId,
    values,
    dryRun: record.dryRun === true,
  };
}

/*** Parse optional credential metadata from an unknown external-API payload. */
function readCredential(value: unknown) {
  const record = readRecord(value);
  if (!record || typeof record.id !== 'string' || typeof record.kind !== 'string') return undefined;
  return {
    id: record.id,
    kind: record.kind,
    label: readString(record.label),
    scope: readString(record.scope),
  };
}

/***
 * Parse an optional record whose values satisfy the shared DataContractValue contract.
 * @todo Move this reusable data-contract parser beside `DataContractValue` in `@ankhorage/contracts/data` rather than Utility.
 */
function readDataValues(value: unknown): Readonly<Record<string, DataContractValue>> | undefined {
  if (value === undefined) return undefined;
  const record = readRecord(value);
  if (!record || !Object.values(record).every(isDataContractValue)) return undefined;
  return record as Readonly<Record<string, DataContractValue>>;
}

/***
 * Recursively validate the shared DataContractValue union.
 * @todo Move this reusable guard to `@ankhorage/contracts/data`; the same implementation already appears elsewhere in Studio.
 */
function isDataContractValue(value: unknown): value is DataContractValue {
  if (value === null || ['boolean', 'number', 'string'].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isDataContractValue);
  const record = readRecord(value);
  return record !== null && Object.values(record).every(isDataContractValue);
}

/***
 * Validate the DataOperationIntent literal union.
 * @todo Move this guard beside `DataOperationIntent` in `@ankhorage/contracts/data`.
 */
function isIntent(value: unknown): value is DataOperationIntent {
  return (
    value === 'action' ||
    value === 'create' ||
    value === 'delete' ||
    value === 'read' ||
    value === 'update'
  );
}

/***
 * Narrow an unknown non-array object to a string-keyed record.
 * @utility @ankhorage/utility/object
 */
function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/***
 * Read a trimmed non-empty string from an unknown value.
 * @utility @ankhorage/utility/string
 */
function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
