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
                {id} · {source.kind} · {countOperations(source)} operations
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

function describeLocation(source: DataSourceConfig): string | undefined {
  if (source.kind === 'graphql') return source.endpointUrl;
  if (source.kind === 'openapi' || source.kind === 'rest') return source.baseUrl;
  return undefined;
}
