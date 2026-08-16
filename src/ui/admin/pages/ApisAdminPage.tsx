import React from 'react';

import { useStudio } from '../../../core/StudioContext';
import type { StudioAdminRouteId } from '../../../index';
import { AdminHeader, AdminScroll } from '../adminPagePrimitives';
import { ApiCatalogCard } from './ApiCatalogCard';
import { ApiOperationsCard } from './ApiOperationsCard';
import { ExternalApiConnectCard } from './ExternalApiConnectCard';
import { ManualRestSourceCard } from './ManualRestSourceCard';

export type ApisAdminRouteId = Extract<
  StudioAdminRouteId,
  'apis' | 'api-data-sources' | 'api-operations'
>;

export function ApisAdminPage({ routeId }: { readonly routeId: ApisAdminRouteId }) {
  const studio = useStudio();
  const apis = studio.manifest?.infra.apis ?? [];
  const showAuthoring = routeId === 'apis';
  const showCatalog = routeId === 'apis' || routeId === 'api-data-sources';
  const showOperations = routeId === 'apis' || routeId === 'api-operations';

  return (
    <AdminScroll>
      <AdminHeader
        title={routeId === 'api-operations' ? 'Operations' : routeId === 'api-data-sources' ? 'Catalog' : 'APIs'}
        description="Connect external APIs, inspect their canonical definitions, and test runtime operations."
      />
      {showAuthoring ? <ExternalApiConnectCard /> : null}
      {showAuthoring ? <ManualRestSourceCard /> : null}
      {showCatalog ? <ApiCatalogCard apis={apis} /> : null}
      {showOperations ? <ApiOperationsCard apis={apis} /> : null}
    </AdminScroll>
  );
}
