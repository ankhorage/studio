import React from 'react';

import { useStudio } from '../../../core/StudioContext';
import type { StudioAdminRouteId } from '../../../index';
import { AdminHeader, AdminScroll } from '../adminPagePrimitives';
import { ApiCatalogCard } from './ApiCatalogCard';
import { ApiOperationsCard } from './ApiOperationsCard';
import { ExternalApiConnectCard } from './ExternalApiConnectCard';
import { ManualRestApiCard } from './ManualRestApiCard';

export type ApisAdminRouteId = Extract<
  StudioAdminRouteId,
  'apis' | 'api-catalog' | 'api-operations'
>;

/*** Compose API authoring, catalog, and operation administration sections according to the active API admin subroute. */
export function ApisAdminPage({ routeId }: { readonly routeId: ApisAdminRouteId }) {
  const studio = useStudio();
  const apis = studio.manifest?.infra.apis ?? [];
  const showAuthoring = routeId === 'apis';
  const showCatalog = routeId === 'apis' || routeId === 'api-catalog';
  const showOperations = routeId === 'apis' || routeId === 'api-operations';

  return (
    <AdminScroll>
      <AdminHeader
        title={
          routeId === 'api-operations'
            ? 'Operations'
            : routeId === 'api-catalog'
              ? 'Catalog'
              : 'APIs'
        }
        description="Connect external APIs, inspect their canonical definitions, and test runtime operations."
      />
      {showAuthoring ? <ExternalApiConnectCard /> : null}
      {showAuthoring ? <ManualRestApiCard /> : null}
      {showCatalog ? <ApiCatalogCard apis={apis} /> : null}
      {showOperations ? <ApiOperationsCard apis={apis} /> : null}
    </AdminScroll>
  );
}
