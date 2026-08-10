import type { DataSourceConfig, DataSourceRegistry } from '@ankhorage/contracts/data';
import { Card, Text } from '@ankhorage/zora';
import { View } from 'react-native';

import { externalApiAdminStyles } from './ExternalApiAdminPrimitives';

export function DataSourceCatalogCard({
  dataSources,
}: {
  readonly dataSources: DataSourceRegistry;
}) {
  const entries = Object.entries(dataSources);
  return (
    <Card title="Connected data sources">
      {entries.length === 0 ? (
        <Text color="neutral" emphasis="muted">
          No data sources are configured.
        </Text>
      ) : (
        <View style={externalApiAdminStyles.stack}>
          {entries.map(([id, source]) => (
            <View key={id} style={externalApiAdminStyles.row}>
              <Text weight="semiBold">{source.name ?? id}</Text>
              <Text color="neutral" emphasis="muted" variant="bodySmall">
                {describeSourceKind(source)} · {countOperations(source)} operations
              </Text>
              {describeLocation(source) ? (
                <Text color="neutral" variant="caption">
                  {describeLocation(source)}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

function countOperations(source: DataSourceConfig): number {
  return Object.values(source.endpoints).reduce(
    (count, endpoint) => count + Object.keys(endpoint.operations).length,
    0,
  );
}

function describeSourceKind(source: DataSourceConfig): string {
  if (source.kind === 'database') return `${source.id} · database`;
  return `${source.id} · api · ${source.origin} · ${source.protocol}`;
}

function describeLocation(source: DataSourceConfig): string | undefined {
  if (source.kind === 'database') return `adapter: ${source.adapter.id}`;
  if (source.origin === 'generated') {
    return `generated: ${source.generatedApiId} · adapter: ${source.adapter.id}`;
  }
  if (source.protocol === 'graphql') return source.endpointUrl;
  return source.openApi ? `${source.baseUrl} · OpenAPI import` : source.baseUrl;
}
