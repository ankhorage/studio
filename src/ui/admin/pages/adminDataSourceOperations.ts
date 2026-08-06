import type { DataSourceRegistry } from '@ankhorage/contracts/data';

export interface DataSourceOperationRow {
  readonly sourceId: string;
  readonly endpointId: string;
  readonly operationId: string;
  readonly name?: string;
  readonly kind: string;
  readonly protocol: string | null;
  readonly method: string | null;
  readonly path: string | null;
}

export function collectDataSourceOperationRows(
  dataSources: DataSourceRegistry,
): DataSourceOperationRow[] {
  return Object.entries(dataSources).flatMap(([sourceId, source]) =>
    Object.entries(source.endpoints).flatMap(([endpointId, endpoint]) =>
      Object.entries(endpoint.operations).map(([operationId, operation]) => ({
        sourceId,
        endpointId,
        operationId,
        name: operation.name,
        kind: operation.intent,
        protocol: operation.protocol ?? endpoint.kind,
        method: operation.method ?? null,
        path: operation.path ?? endpoint.path ?? null,
      })),
    ),
  );
}
