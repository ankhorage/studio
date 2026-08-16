import type { ApiDefinitionList } from '@ankhorage/contracts/data';

export interface ApiOperationRow {
  readonly apiId: string;
  readonly endpointId: string;
  readonly operationId: string;
  readonly name?: string;
  readonly intent: string;
  readonly protocol: string;
  readonly method: string | null;
  readonly path: string | null;
  readonly apiOrigin: 'external' | 'internal';
  readonly apiProtocol: 'graphql' | 'rest';
  readonly testable: boolean;
}

export function collectApiOperationRows(apis: ApiDefinitionList): ApiOperationRow[] {
  return apis.flatMap((api) =>
    Object.entries(api.endpoints).flatMap(([endpointId, endpoint]) =>
      Object.entries(endpoint.operations).map(([operationId, operation]) => ({
        apiId: api.id,
        endpointId,
        operationId,
        name: operation.name,
        intent: operation.intent,
        protocol: operation.protocol,
        method: operation.method ?? null,
        path: operation.path ?? endpoint.path ?? null,
        apiOrigin: api.origin,
        apiProtocol: api.protocol,
        testable: api.origin === 'external',
      })),
    ),
  );
}
