import type { DataSourceRegistry } from '@ankhorage/contracts';

import { readRecord, readString } from '../adminPageUtils';

export interface DataSourceOperationRow {
  readonly sourceId: string;
  readonly endpointId: string;
  readonly operationId: string;
  readonly kind: string;
  readonly protocol: string | null;
}

export function collectDataSourceOperationRows(
  dataSources: DataSourceRegistry,
): DataSourceOperationRow[] {
  return Object.entries(dataSources).flatMap(([sourceId, source]) =>
    Object.entries(readRecord(source).endpoints ?? {}).flatMap(([endpointId, endpoint]) =>
      Object.entries(readRecord(endpoint).operations ?? {}).map(([operationId, operation]) => ({
        sourceId,
        endpointId,
        operationId,
        kind: readString(readRecord(operation).intent) ?? 'operation',
        protocol:
          readString(readRecord(operation).protocol) ?? readString(readRecord(endpoint).kind),
      })),
    ),
  );
}
