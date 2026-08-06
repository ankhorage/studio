import type { DataContractValue, DataOperationIntent } from '@ankhorage/contracts/data';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type {
  ExternalApiConnectRequest,
  ExternalApiOperationTestRequest,
  ManualRestSourceRequest,
} from '../../externalApiAuthoringContracts';
import { StudioExternalApiService } from '../dataSources/studioExternalApiService';
import type { ProjectManager } from '../orchestrator/projectManager';
import { ProjectSecretService } from '../secrets/projectSecretService';

export function registerProjectDataSourceRoutes(
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

  fastify.post('/api/projects/:id/data-sources/connect', async (request, reply) => {
    const body = readConnectRequest(request.body);
    if (!body) return invalidPayload(reply, 'External API connection payload is invalid.');
    return sendResult(reply, await service.connect(readProjectId(request), body));
  });

  fastify.post('/api/projects/:id/data-sources/manual-rest', async (request, reply) => {
    const body = readManualRestRequest(request.body);
    if (!body) return invalidPayload(reply, 'Manual REST data-source payload is invalid.');
    return sendResult(reply, await service.createManualRest(readProjectId(request), body));
  });

  fastify.post('/api/projects/:id/data-sources/test', async (request, reply) => {
    const body = readOperationTestRequest(request.body);
    if (!body) return invalidPayload(reply, 'Data-source operation test payload is invalid.');
    return sendResult(reply, await service.testOperation(readProjectId(request), body));
  });
}

function readProjectId(request: FastifyRequest): string {
  return (request.params as { readonly id: string }).id;
}

function sendResult(reply: FastifyReply, result: { readonly ok: boolean }) {
  return result.ok ? result : reply.status(422).send(result);
}

function invalidPayload(reply: FastifyReply, message: string) {
  return reply.status(400).send({
    ok: false,
    diagnostics: [{ code: 'invalid-config', message, severity: 'error' }],
  });
}

function readConnectRequest(value: unknown): ExternalApiConnectRequest | null {
  const record = readRecord(value);
  const protocol = record?.protocol;
  if (
    !record ||
    typeof record.sourceId !== 'string' ||
    typeof record.url !== 'string' ||
    (protocol !== 'auto' && protocol !== 'graphql' && protocol !== 'openapi')
  ) {
    return null;
  }
  return {
    sourceId: record.sourceId,
    url: record.url,
    protocol,
    name: readString(record.name),
    description: readString(record.description),
    credential: readCredential(record.credential),
  };
}

function readManualRestRequest(value: unknown): ManualRestSourceRequest | null {
  const record = readRecord(value);
  if (
    !record ||
    typeof record.sourceId !== 'string' ||
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
    sourceId: record.sourceId,
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

function readOperationTestRequest(value: unknown): ExternalApiOperationTestRequest | null {
  const record = readRecord(value);
  if (
    !record ||
    typeof record.sourceId !== 'string' ||
    typeof record.endpointId !== 'string' ||
    typeof record.operationId !== 'string'
  ) {
    return null;
  }
  const values = readDataValues(record.values);
  if (record.values !== undefined && values === undefined) return null;
  return {
    sourceId: record.sourceId,
    endpointId: record.endpointId,
    operationId: record.operationId,
    values,
    dryRun: record.dryRun === true,
  };
}

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

function readDataValues(value: unknown): Readonly<Record<string, DataContractValue>> | undefined {
  if (value === undefined) return undefined;
  const record = readRecord(value);
  if (!record || !Object.values(record).every(isDataContractValue)) return undefined;
  return record as Readonly<Record<string, DataContractValue>>;
}

function isDataContractValue(value: unknown): value is DataContractValue {
  if (value === null || ['boolean', 'number', 'string'].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isDataContractValue);
  const record = readRecord(value);
  return record !== null && Object.values(record).every(isDataContractValue);
}

function isIntent(value: unknown): value is DataOperationIntent {
  return (
    value === 'action' ||
    value === 'create' ||
    value === 'delete' ||
    value === 'read' ||
    value === 'update'
  );
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
