import type { ApiDefinition, ApiDefinitionList } from '@ankhorage/contracts/data';
import { Card, Text } from '@ankhorage/zora';
import { View } from 'react-native';

import { externalApiAdminStyles } from './ExternalApiAdminPrimitives';

/*** Render canonical API definitions as compact catalog rows for Studio administration. */
export function ApiCatalogCard({ apis }: { readonly apis: ApiDefinitionList }) {
  return (
    <Card title="APIs">
      {apis.length === 0 ? (
        <Text color="neutral" emphasis="muted">
          No APIs are configured.
        </Text>
      ) : (
        <View style={externalApiAdminStyles.stack}>
          {apis.map((api) => (
            <View key={api.id} style={externalApiAdminStyles.row}>
              <Text weight="semiBold">{api.name ?? api.id}</Text>
              <Text color="neutral" emphasis="muted" variant="bodySmall">
                {api.id} · {api.origin} · {api.protocol} · {countOperations(api)} operations
              </Text>
              <Text color="neutral" variant="caption">
                {describeLocation(api)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

/*** Count all operations across every endpoint of one canonical API definition. */
function countOperations(api: ApiDefinition): number {
  return Object.values(api.endpoints).reduce(
    (count, endpoint) => count + Object.keys(endpoint.operations).length,
    0,
  );
}

/*** Format the protocol/origin-specific API location shown in the administration catalog. */
function describeLocation(api: ApiDefinition): string {
  if (api.origin === 'internal') return api.basePath;
  if (api.protocol === 'graphql') return api.endpointUrl;
  return api.openApi ? `${api.baseUrl} · OpenAPI import` : api.baseUrl;
}
