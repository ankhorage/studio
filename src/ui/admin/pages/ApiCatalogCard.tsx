import type { ApiDefinition, ApiDefinitionList } from '@ankhorage/contracts/data';
import { Badge, Button, ButtonGroup, Card, ListRow, ListSection, Text } from '@ankhorage/zora';
import { View } from 'react-native';

import { externalApiAdminStyles } from './ExternalApiAdminPrimitives';

interface ApiCatalogCardProps {
  readonly apis: ApiDefinitionList;
  readonly onEdit?: (apiId: string) => void;
  readonly onRemove?: (apiId: string) => void;
}

/*** Render canonical APIs as scannable endpoint catalogs with external API edit and remove actions. */
export function ApiCatalogCard({ apis, onEdit, onRemove }: ApiCatalogCardProps) {
  return (
    <Card
      title="Connected APIs"
      description="Discovered endpoints stay read-only here; advanced settings are available per connected external API."
    >
      {apis.length === 0 ? (
        <Text color="neutral" emphasis="muted">
          No APIs are connected yet. Enter a service or schema URL above to discover one.
        </Text>
      ) : (
        <View style={externalApiAdminStyles.stack}>
          {apis.map((api) => (
            <ListSection
              key={api.id}
              title={api.name ?? api.id}
              eyebrow={describeLocation(api)}
              description={`${api.id} · ${api.origin} · ${api.protocol} · ${countOperations(api)} operation${countOperations(api) === 1 ? '' : 's'}`}
              actions={renderApiActions(api, onEdit, onRemove)}
            >
              {renderEndpointRows(api)}
            </ListSection>
          ))}
        </View>
      )}
    </Card>
  );
}

/*** Render edit/remove controls only for external APIs whose corresponding handlers are available. */
function renderApiActions(
  api: ApiDefinition,
  onEdit: ApiCatalogCardProps['onEdit'],
  onRemove: ApiCatalogCardProps['onRemove'],
) {
  if (api.origin !== 'external' || !onEdit || !onRemove) return undefined;
  return (
    <ButtonGroup orientation="responsive" align="end">
      <Button variant="outline" onPress={() => onEdit(api.id)}>
        Edit
      </Button>
      <Button color="danger" variant="ghost" onPress={() => onRemove(api.id)}>
        Remove
      </Button>
    </ButtonGroup>
  );
}

/*** Render every canonical endpoint operation with readable path, stable ids, and a textual HTTP/protocol badge. */
function renderEndpointRows(api: ApiDefinition) {
  const endpointEntries = Object.entries(api.endpoints);
  if (endpointEntries.length === 0) {
    return (
      <ListRow
        title="No endpoints discovered"
        description="The API is connected, but its canonical definition does not currently expose operations."
        variant="card"
      />
    );
  }

  return endpointEntries.flatMap(([endpointId, endpoint]) => {
    const operations = Object.entries(endpoint.operations);
    if (operations.length === 0) {
      return [
        <ListRow
          key={`${api.id}:${endpointId}:empty`}
          title={formatPath(endpoint.path) ?? endpointId}
          description="No operations discovered for this endpoint."
          meta={endpointId}
          variant="card"
        />,
      ];
    }

    return operations.map(([operationId, operation]) => {
      const method = operation.method ?? (operation.protocol === 'graphql' ? 'GRAPHQL' : operation.protocol.toUpperCase());
      return (
        <ListRow
          key={`${api.id}:${endpointId}:${operationId}`}
          title={formatPath(operation.path ?? endpoint.path) ?? operation.name ?? operationId}
          description={operation.name ? `${operation.name} · ${operation.intent}` : operation.intent}
          meta={`${endpointId} · ${operationId}`}
          leading={<Badge>{method}</Badge>}
          variant="card"
        />
      );
    });
  });
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
  return api.openApi?.url ?? api.baseUrl;
}

/*** Normalize a canonical endpoint path for compact catalog display without hiding the root path. */
function formatPath(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.replace(/^\/+/, '');
  return normalized || '/';
}
