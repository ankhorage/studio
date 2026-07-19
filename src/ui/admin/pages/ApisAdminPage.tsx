import { Card, Text } from '@ankhorage/zora';
import React from 'react';
import { View } from 'react-native';

import { useStudio } from '../../../core/StudioContext';
import type { StudioAdminRouteId } from '../../../index';
import { AdminHeader, adminPageStyles, AdminScroll } from '../adminPagePrimitives';
import { readRecord, readString } from '../adminPageUtils';
import { collectDataSourceOperationRows } from './adminDataSourceOperations';

export type ApisAdminRouteId = Extract<
  StudioAdminRouteId,
  'apis' | 'api-data-sources' | 'api-operations'
>;

export function ApisAdminPage({ routeId }: { readonly routeId: ApisAdminRouteId }) {
  const studio = useStudio();
  const dataSources = Object.entries(studio.manifest?.dataSources ?? {});
  const operationRows = collectDataSourceOperationRows(studio.manifest?.dataSources ?? {});
  const showSources = routeId === 'apis' || routeId === 'api-data-sources';
  const showOperations = routeId === 'apis' || routeId === 'api-operations';

  return (
    <AdminScroll>
      <AdminHeader
        title={
          routeId === 'api-operations'
            ? 'Operations'
            : routeId === 'api-data-sources'
              ? 'Data sources'
              : 'APIs'
        }
        description="Current data-source and runtime operation configuration from the Studio manifest."
      />
      {showSources ? (
        <Card title="Data sources">
          {dataSources.length > 0 ? (
            dataSources.map(([id, source]) => (
              <View key={id} style={adminPageStyles.row}>
                <Text weight="semiBold">{id}</Text>
                <Text color="neutral" emphasis="muted" variant="bodySmall">
                  {readString(readRecord(source).kind) ?? 'data source'}
                </Text>
              </View>
            ))
          ) : (
            <Text color="neutral" emphasis="muted">
              No data sources are configured.
            </Text>
          )}
        </Card>
      ) : null}
      {showOperations ? (
        <Card title="Operations">
          {operationRows.length > 0 ? (
            operationRows.map((row) => (
              <View
                key={`${row.sourceId}:${row.endpointId}:${row.operationId}`}
                style={adminPageStyles.row}
              >
                <Text weight="semiBold">{row.operationId}</Text>
                <Text color="neutral" emphasis="muted" variant="bodySmall">
                  {row.sourceId} / {row.endpointId} - {row.kind}
                  {row.protocol ? ` (${row.protocol})` : ''}
                </Text>
              </View>
            ))
          ) : (
            <Text color="neutral" emphasis="muted">
              No runtime operations are configured.
            </Text>
          )}
        </Card>
      ) : null}
    </AdminScroll>
  );
}
