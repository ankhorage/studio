import type { DataSourceConfig, DataSourceRegistry } from '@ankhorage/contracts/data';

export interface ExternalApiDataSourceUpsertResult {
  readonly registry: DataSourceRegistry;
  readonly created: boolean;
}

export function upsertExternalApiDataSource(
  registry: DataSourceRegistry,
  source: DataSourceConfig,
): ExternalApiDataSourceUpsertResult {
  return {
    registry: { ...registry, [source.id]: source },
    created: registry[source.id] === undefined,
  };
}
