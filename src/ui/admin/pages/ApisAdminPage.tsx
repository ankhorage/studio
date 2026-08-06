import React from 'react';

import { useStudio } from '../../../core/StudioContext';
import type { StudioAdminRouteId } from '../../../index';
import { AdminHeader, AdminScroll } from '../adminPagePrimitives';
import { DataSourceCatalogCard } from './DataSourceCatalogCard';
import { DataSourceOperationsCard } from './DataSourceOperationsCard';
import { ExternalApiConnectCard } from './ExternalApiConnectCard';
import { ManualRestSourceCard } from './ManualRestSourceCard';

export type ApisAdminRouteId = Extract<
  StudioAdminRouteId,
  'apis' | 'api-data-sources' | 'api-operations'
>;

export function ApisAdminPage({ routeId }: { readonly routeId: ApisAdminRouteId }) {
  const studio = useStudio();
  const dataSources = studio.manifest?.dataSources ?? {};
  const showAuthoring = routeId === 'apis';
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
        description="Connect external services into canonical data sources and inspect their runtime operations."
      />
      {showAuthoring ? <ExternalApiConnectCard /> : null}
      {showAuthoring ? <ManualRestSourceCard /> : null}
      {showSources ? <DataSourceCatalogCard dataSources={dataSources} /> : null}
      {showOperations ? <DataSourceOperationsCard dataSources={dataSources} /> : null}
    </AdminScroll>
  );
}
