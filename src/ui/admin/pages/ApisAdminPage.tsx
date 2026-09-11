import { ConfirmDialog, Text } from '@ankhorage/zora';
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';

import { useStudio } from '../../../core/StudioContext';
import { removeExternalApiConnection } from '../../../externalApiApi';
import type { StudioAdminRouteId } from '../../../index';
import { AdminHeader, AdminScroll } from '../adminPagePrimitives';
import { ApiCatalogCard } from './ApiCatalogCard';
import { ApiOperationsCard } from './ApiOperationsCard';
import { ExternalApiConnectCard } from './ExternalApiConnectCard';
import { ExternalApiEditCard } from './ExternalApiEditCard';
import { ManualRestApiCard } from './ManualRestApiCard';

export type ApisAdminRouteId = Extract<
  StudioAdminRouteId,
  'apis' | 'api-catalog' | 'api-operations'
>;

interface DiscoveryFallback {
  readonly apiId: string;
  readonly url: string;
}

/*** Compose progressive API discovery, canonical endpoint catalog, advanced editing, removal, and secondary operation testing. */
export function ApisAdminPage({ routeId }: { readonly routeId: ApisAdminRouteId }) {
  const studio = useStudio();
  const apis = studio.manifest?.infra.apis ?? [];
  const [fallback, setFallback] = useState<DiscoveryFallback | null>(null);
  const [editingApiId, setEditingApiId] = useState<string | null>(null);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const showAuthoring = routeId === 'apis';
  const showCatalog = routeId === 'apis' || routeId === 'api-catalog';
  const showOperations = routeId === 'api-operations';
  const editingApi = apis.find((api) => api.id === editingApiId);
  const editableApi = editingApi?.origin === 'external' ? editingApi : null;
  const pendingRemoveApi = apis.find((api) => api.id === pendingRemoveId);

  /*** Clear transient fallback/edit state after a successful API add or manual fallback save. */
  const finishConnection = useCallback((apiId: string) => {
    setFallback(null);
    setEditingApiId(null);
    setStatus(`API ${apiId} is connected.`);
  }, []);

  /*** Open the advanced settings disclosure for exactly one existing external API. */
  const editApi = useCallback((apiId: string) => {
    setFallback(null);
    setStatus(null);
    setEditingApiId(apiId);
  }, []);

  /*** Prepare an accessible destructive confirmation for one external API. */
  const requestRemove = useCallback((apiId: string) => {
    setRemoveError(null);
    setPendingRemoveId(apiId);
  }, []);

  /*** Remove the confirmed external API through the canonical host mutation and refresh manifest state before reporting success. */
  const confirmRemove = useCallback(async () => {
    if (!pendingRemoveId || removeBusy) return;
    setRemoveBusy(true);
    setRemoveError(null);
    try {
      const result = await removeExternalApiConnection(studio.projectId, {
        apiId: pendingRemoveId,
      });
      if (!result.ok) {
        setRemoveError(result.diagnostics[0]?.message ?? 'API removal failed.');
        return;
      }
      await studio.refetchManifest();
      if (editingApiId === result.apiId) setEditingApiId(null);
      if (fallback?.apiId === result.apiId) setFallback(null);
      setPendingRemoveId(null);
      setStatus(`API ${result.apiId} was removed.`);
    } catch (error) {
      setRemoveError(error instanceof Error ? error.message : 'API removal failed.');
    } finally {
      setRemoveBusy(false);
    }
  }, [editingApiId, fallback?.apiId, pendingRemoveId, removeBusy, studio]);

  /*** Close removal confirmation unless its canonical mutation is currently in progress. */
  const cancelRemove = useCallback(() => {
    if (removeBusy) return;
    setPendingRemoveId(null);
    setRemoveError(null);
  }, [removeBusy]);

  return (
    <>
      <AdminScroll>
        <AdminHeader
          title={
            routeId === 'api-operations'
              ? 'Operations'
              : routeId === 'api-catalog'
                ? 'API catalog'
                : 'APIs'
          }
          description={
            routeId === 'api-operations'
              ? 'Test canonical API operations without mixing execution controls into the connection workflow.'
              : 'Connect services from a URL, inspect discovered endpoints, and reveal advanced settings only when needed.'
          }
        />

        {showAuthoring ? (
          <ExternalApiConnectCard
            onConnected={finishConnection}
            onDiscoveryFailed={(failure) => {
              setFallback(failure);
              setStatus(null);
            }}
            onResetFailure={() => {
              setFallback(null);
              setStatus(null);
            }}
          />
        ) : null}

        {showAuthoring && fallback ? (
          <ManualRestApiCard
            apiId={fallback.apiId}
            attemptedUrl={fallback.url}
            onRetry={() => setFallback(null)}
            onSaved={finishConnection}
          />
        ) : null}

        <View accessibilityLiveRegion="polite">
          {status ? <Text variant="bodySmall">{status}</Text> : null}
        </View>

        {showCatalog ? (
          <ApiCatalogCard apis={apis} onEdit={editApi} onRemove={requestRemove} />
        ) : null}

        {showCatalog && editableApi ? (
          <ExternalApiEditCard
            key={editableApi.id}
            api={editableApi}
            onCancel={() => setEditingApiId(null)}
            onSaved={(apiId) => {
              setEditingApiId(null);
              setStatus(`API ${apiId} settings were updated.`);
            }}
          />
        ) : null}

        {showOperations ? <ApiOperationsCard apis={apis} /> : null}
      </AdminScroll>

      <ConfirmDialog
        visible={pendingRemoveId !== null}
        title="Remove API?"
        description={
          pendingRemoveApi
            ? `Remove ${pendingRemoveApi.name ?? pendingRemoveApi.id} from the canonical project manifest? Existing bindings to this API will no longer resolve.`
            : undefined
        }
        confirmLabel="Remove API"
        confirmColor="danger"
        busy={removeBusy}
        onCancel={cancelRemove}
        onConfirm={() => void confirmRemove()}
      >
        {removeError ? <Text color="danger">{removeError}</Text> : null}
      </ConfirmDialog>
    </>
  );
}
