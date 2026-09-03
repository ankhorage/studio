import type {
  AuthOAuthProviderConfig,
  ComponentDataBindingRegistry,
  DataSourceRegistry,
  MediaAsset,
  NavigatorType,
  UiNode,
} from '@ankhorage/contracts';
import { DEFAULT_AUTH_FLOW } from '@ankhorage/contracts';
import React, { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  readStudioAuthSettings,
  type StudioAuthSettings,
  type StudioAuthSettingsMutation,
} from '../authSettings';
import {
  createNodeFromCatalogEntry,
  findNodeById,
  type InsertCatalogEntry,
  type NodePlacement,
  type StudioAdminRouteId,
  type StudioComponentMetaRegistry,
  type StudioContextValue,
  type StudioManifest,
  type StudioNodeId,
  type StudioPanelId,
  type StudioScreenId,
  type ThemeUpdates,
} from '../index';
import {
  addStudioManifestScreen,
  deleteStudioManifestNode,
  deleteStudioManifestScreen,
  hasCanonicalStudioScreenRegistryIdentity,
  insertStudioManifestNodeAtPlacement,
  moveStudioManifestNodeToPlacement,
  moveStudioManifestRoute,
  resolveActiveRootNode,
  resolveInitialActiveScreenId,
  setStudioManifestNavigatorInitialRoute,
  setStudioManifestNavigatorType,
  setStudioManifestRoutePrimaryNavigationVisibility,
} from '../manifestState';
import { createStudioManifestSignature } from '../manifestSync';
import {
  createStudioMediaAssetId,
  removeStudioMediaAsset,
  type StudioMediaDeleteResult,
  upsertStudioMediaAsset,
} from '../mediaAuthoringModel';
import type {
  StudioMediaIngestResult,
  StudioMediaIngestTarget,
  StudioMediaPickerAdapter,
  StudioMediaPickerSource,
} from '../mediaPickerAuthoring';
import { resolveScreenIdForPathname } from '../routeUtils';
import {
  resolveStudioSelectedNodeId,
  resolveStudioSelectionParentNodeId,
} from '../studioSelectionModel';
import { AuthAdminSessionProvider } from '../ui/admin/AuthAdminSession';
import { API_BASE } from './constants';
import { cleanupStudioMediaSource, ingestStudioMediaSelection } from './mediaAuthoringHostClient';
import { commitStudioMediaRemoval } from './mediaRemovalCoordinator';
import { StudioContext } from './StudioContext';
import {
  applyStudioManifestDraftMutation,
  replaceStudioManifestDraftAuthSettings,
  updateStudioManifestDraftAuthSettings,
  updateStudioManifestDraftDataBindings,
  updateStudioManifestDraftDataSources,
  updateStudioManifestDraftNode,
  updateStudioManifestDraftTheme,
} from './studioManifestDraftModel';
import { StudioManifestPersistenceCoordinator } from './studioManifestPersistenceModel';

export interface StudioProviderProps {
  children: ReactNode;
  projectId: string;
  initialManifest?: StudioManifest | null;
  activePathname?: string;
  componentMeta: StudioComponentMetaRegistry;
  mediaPicker?: StudioMediaPickerAdapter;
}

/*** Provide a no-op action for context capabilities that Studio does not currently implement. */
const noop = () => undefined;
const STUDIO_MANIFEST_SAVE_DELAY_MS = 350;

/*** Own Studio authoring state, manifest mutations, media actions, selection, navigation, and persistence for one project. */
export const StudioProvider = ({
  children,
  projectId,
  initialManifest = null,
  activePathname,
  componentMeta,
  mediaPicker,
}: StudioProviderProps) => {
  const [manifest, setManifest] = useState<StudioManifest | null>(initialManifest);
  const [activePanelId, setActivePanelId] = useState<StudioPanelId | null>(null);
  const [activeAdminRouteId, setActiveAdminRouteId] = useState<StudioAdminRouteId>('overview');
  const [activeCanvasDragNodeId, setActiveCanvasDragNodeId] = useState<StudioNodeId | null>(null);
  const [requestedActiveScreenId, setRequestedActiveScreenId] = useState<StudioScreenId | null>(
    null,
  );
  const [selectedNodeId, selectNode] = useState<StudioNodeId | null>(null);
  const [lastNonAdminLocation, setLastNonAdminLocation] = useState('/');
  const [saveStatus, setSaveStatus] = useState<StudioContextValue['saveStatus']>('idle');
  const [isLoading, setIsLoading] = useState(initialManifest === null);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const manifestRef = useRef<StudioManifest | null>(initialManifest);

  /*** Replace the current manifest in both the synchronous ref and React state. */
  const replaceManifest = useCallback((nextManifest: StudioManifest | null) => {
    manifestRef.current = nextManifest;
    setManifest(nextManifest);
  }, []);

  /*** Apply one immutable mutation to the current manifest and publish the resulting draft. */
  const updateManifest = useCallback(
    (mutation: (current: StudioManifest) => StudioManifest): StudioManifest | null => {
      const nextManifest = applyStudioManifestDraftMutation(manifestRef.current, mutation);
      if (!nextManifest) return null;
      replaceManifest(nextManifest);
      return nextManifest;
    },
    [replaceManifest],
  );
  const persistence = useStudioManifestPersistence({
    projectId,
    manifest,
    manifestRef,
    initialManifest,
    replaceManifest,
    setSaveStatus,
    setIsLoading,
    setError,
  });

  const locationActiveScreenId = useMemo<StudioScreenId | null | undefined>(() => {
    if (activePathname === undefined) return undefined;
    if (!manifest) return null;
    return resolveScreenIdForPathname(manifest.navigator, activePathname, manifest.screens);
  }, [activePathname, manifest]);
  const activeScreenId =
    locationActiveScreenId !== undefined
      ? locationActiveScreenId
      : (requestedActiveScreenId ?? resolveInitialActiveScreenId(manifest));

  useEffect(() => {
    if (!locationActiveScreenId) return;
    queueMicrotask(() => {
      setRequestedActiveScreenId((current) =>
        current === locationActiveScreenId ? current : locationActiveScreenId,
      );
    });
  }, [locationActiveScreenId]);

  const rootNode = useMemo<UiNode | null>(
    () => resolveActiveRootNode(manifest, activeScreenId),
    [activeScreenId, manifest],
  );

  useEffect(() => {
    const nextSelectedNodeId = resolveStudioSelectedNodeId(rootNode, selectedNodeId);
    if (selectedNodeId !== nextSelectedNodeId) {
      queueMicrotask(() => {
        selectNode(nextSelectedNodeId);
      });
    }
  }, [rootNode, selectedNodeId]);

  /*** Update the authored props of one manifest node. */
  const updateNode = useCallback(
    (nodeId: StudioNodeId, props: Record<string, unknown>) => {
      updateManifest((current) => updateStudioManifestDraftNode(current, nodeId, props));
    },
    [updateManifest],
  );

  /*** Add or replace one media asset in the current manifest. */
  const upsertMediaAsset = useCallback(
    (asset: MediaAsset) => {
      updateManifest((current) => upsertStudioMediaAsset(current, asset));
    },
    [updateManifest],
  );

  /*** Remove a media asset from the manifest only and report whether it was removed. */
  const removeMediaAsset = useCallback(
    (mediaId: string): boolean => {
      let removed = false;
      updateManifest((current) => {
        const result = removeStudioMediaAsset(current, mediaId);
        removed = result.ok;
        return result.ok ? result.manifest : current;
      });
      return removed;
    },
    [updateManifest],
  );

  /*** Remove a media asset, persist the manifest, and clean up the source owned by Studio. */
  const deleteMediaAsset = useCallback(
    async (mediaId: string): Promise<StudioMediaDeleteResult> => {
      const { current } = manifestRef;
      if (!current) return { ok: false, reason: 'not-found', usages: [] };
      return commitStudioMediaRemoval({
        manifest: current,
        mediaId,
        applyManifest: replaceManifest,
        persistManifest: persistence.flushManifest,
        cleanupSource: (source) => cleanupStudioMediaSource(projectId, source),
      });
    },
    [persistence.flushManifest, projectId, replaceManifest],
  );

  /*** Pick media from the configured adapter, ingest it through the host, and add the asset to the manifest. */
  const ingestMediaFromPicker = useCallback(
    async (
      source: StudioMediaPickerSource,
      target: StudioMediaIngestTarget = 'storage',
    ): Promise<StudioMediaIngestResult> => {
      if (!mediaPicker) return { ok: false, reason: 'Media picker unavailable.' };
      const picked = await mediaPicker.pick({ source });
      if (!picked.ok) return picked;
      const { current } = manifestRef;
      if (!current) return { ok: false, reason: 'Manifest unavailable.' };
      const assetId = createStudioMediaAssetId(picked.selection.name, current.media?.assets);
      const ingested = await ingestStudioMediaSelection({
        projectId,
        assetId,
        selection: picked.selection,
        target,
      });
      if (!ingested.ok) return ingested;
      upsertMediaAsset(ingested.asset);
      return ingested;
    },
    [mediaPicker, projectId, upsertMediaAsset],
  );

  /*** Apply authored updates to one theme entry. */
  const updateTheme = useCallback(
    (id: string, updates: ThemeUpdates) => {
      updateManifest((current) => updateStudioManifestDraftTheme(current, id, updates));
    },
    [updateManifest],
  );

  /*** Replace the manifest auth settings with an explicit authored value. */
  const updateAuthSettings = useCallback(
    (settings: StudioAuthSettings) => {
      updateManifest((current) => updateStudioManifestDraftAuthSettings(current, settings));
    },
    [updateManifest],
  );

  /*** Apply a caller-provided mutation to the current auth settings and return the resulting settings. */
  const mutateAuthSettings = useCallback(
    (mutation: StudioAuthSettingsMutation) => {
      let nextSettings: StudioAuthSettings | null = null;
      updateManifest((current) => {
        nextSettings = mutation(readStudioAuthSettings(current));
        return replaceStudioManifestDraftAuthSettings(current, nextSettings);
      });
      return nextSettings;
    },
    [updateManifest],
  );

  /*** Replace OAuth providers while preserving or creating the surrounding Studio auth configuration. */
  const updateOAuthProviders = useCallback(
    (providers: AuthOAuthProviderConfig[]) => {
      updateManifest((current) => {
        const currentAuth = readStudioAuthSettings(current);
        const nextAuth = currentAuth ?? {
          scope: 'none',
          provider: 'supabase',
          flow: { ...DEFAULT_AUTH_FLOW },
          signIn: { identifiers: ['email'] },
        };
        return updateStudioManifestDraftAuthSettings(current, {
          ...nextAuth,
          oauth: {
            enabled: nextAuth.oauth?.enabled ?? false,
            callbackRoute: nextAuth.oauth?.callbackRoute ?? '/auth/callback',
            providers,
          },
        });
      });
    },
    [updateManifest],
  );

  /*** Create and insert a component node from one enabled catalog entry at its resolved placement. */
  const insertFromCatalogEntry = useCallback(
    (entry: InsertCatalogEntry): boolean => {
      if (entry.status !== 'enabled' || !entry.placement) return false;
      const { placement } = entry;
      const { current } = manifestRef;
      if (!current) return false;
      const insertion = insertStudioManifestNodeAtPlacement({
        manifest: current,
        activeScreenId,
        placement,
        newNode: createNodeFromCatalogEntry(entry, componentMeta),
        componentMeta,
      });
      if (!insertion) return false;
      updateManifest(() => insertion.manifest);
      selectNode(insertion.insertedNodeId);
      return true;
    },
    [activeScreenId, componentMeta, updateManifest],
  );

  /*** Move an existing canvas node to a validated placement and keep the moved node selected. */
  const moveSelectedNodeToPlacement = useCallback(
    (nodeId: StudioNodeId, placement: NodePlacement): boolean => {
      const { current } = manifestRef;
      if (!current) return false;
      const movement = moveStudioManifestNodeToPlacement({
        manifest: current,
        activeScreenId,
        nodeId,
        placement,
        componentMeta,
      });
      if (!movement) return false;
      updateManifest(() => movement.manifest);
      selectNode(movement.movedNodeId);
      return true;
    },
    [activeScreenId, componentMeta, updateManifest],
  );

  /*** Delete one non-root node and move selection to its former parent. */
  const deleteNode = useCallback(
    (nodeId: StudioNodeId) => {
      const currentRoot = resolveActiveRootNode(manifestRef.current, activeScreenId);
      if (!currentRoot || currentRoot.id === nodeId || !findNodeById(currentRoot, nodeId)) return;
      const parentNodeId = resolveStudioSelectionParentNodeId(currentRoot, nodeId);
      const { current } = manifestRef;
      if (!current) return;
      const next = deleteStudioManifestNode(current, activeScreenId, nodeId);
      if (next === current) return;
      updateManifest(() => next);
      selectNode(parentNodeId);
      setActiveCanvasDragNodeId((activeNodeId) => (activeNodeId === nodeId ? null : activeNodeId));
    },
    [activeScreenId, updateManifest],
  );

  /*** Add a screen and switch Studio authoring state to the newly active screen. */
  const addScreen = useCallback(
    (name: string) => {
      const { current } = manifestRef;
      if (!current) return;
      const result = addStudioManifestScreen({
        manifest: current,
        name,
        activeScreenId,
      });
      if (result.manifest === current || !result.activeScreenId) return;
      updateManifest(() => result.manifest);
      setRequestedActiveScreenId(result.activeScreenId);
      selectNode(null);
      setActiveCanvasDragNodeId(null);
    },
    [activeScreenId, updateManifest],
  );

  /*** Delete a screen and clear selection or drag state that referenced the deleted tree. */
  const deleteScreen = useCallback(
    (screenId: StudioScreenId) => {
      const { current } = manifestRef;
      if (!current || !hasCanonicalStudioScreenRegistryIdentity(current.screens)) return;
      const deletedRoot = Object.values(current.screens).find(
        (screen) => screen.id === screenId,
      )?.root;
      const result = deleteStudioManifestScreen(current, screenId, activeScreenId);
      if (result.manifest === current || !deletedRoot) return;
      updateManifest(() => result.manifest);
      setRequestedActiveScreenId(result.activeScreenId);
      if (selectedNodeId && findNodeById(deletedRoot, selectedNodeId)) {
        selectNode(null);
      }
      setActiveCanvasDragNodeId((nodeId) =>
        nodeId && findNodeById(deletedRoot, nodeId) ? null : nodeId,
      );
    },
    [activeScreenId, selectedNodeId, updateManifest],
  );

  /*** Change the manifest navigator type. */
  const setNavigatorType = useCallback(
    (type: NavigatorType) => {
      updateManifest((current) => setStudioManifestNavigatorType(current, type));
    },
    [updateManifest],
  );

  /*** Change the navigator route used as the initial route. */
  const setNavigatorInitialRoute = useCallback(
    (routeName: string) => {
      updateManifest((current) => setStudioManifestNavigatorInitialRoute(current, routeName));
    },
    [updateManifest],
  );

  /*** Change whether a route is visible in the generated primary navigation. */
  const setRoutePrimaryNavigationVisibility = useCallback(
    (parentPath: string[], routeName: string, showInPrimaryNavigation: boolean) => {
      updateManifest((current) =>
        setStudioManifestRoutePrimaryNavigationVisibility({
          manifest: current,
          parentPath,
          routeName,
          showInPrimaryNavigation,
        }),
      );
    },
    [updateManifest],
  );

  /*** Reorder one route within its navigator parent. */
  const moveRoute = useCallback(
    (parentPath: string[], routeName: string, toIndex: number) => {
      updateManifest((current) =>
        moveStudioManifestRoute({ manifest: current, parentPath, routeName, toIndex }),
      );
    },
    [updateManifest],
  );

  /*** Select an existing canonical screen as the requested active authoring screen. */
  const setActiveScreenId = useCallback((screenId: StudioScreenId) => {
    const { current } = manifestRef;
    if (!current || !hasCanonicalStudioScreenRegistryIdentity(current.screens)) return;
    const screen = Object.values(current.screens).find((candidate) => candidate.id === screenId);
    if (!screen) return;
    setRequestedActiveScreenId(screenId);
  }, []);

  const value = useMemo<StudioContextValue>(
    () => ({
      projectId,
      activeScreenId,
      selectedNodeId,
      activePanelId,
      activeAdminRouteId,
      activeCanvasDragNodeId,
      previewMode,
      lastNonAdminLocation,
      saveStatus,
      isLoading,
      error,
      manifest,
      rootNode,
      componentMeta,
      selectNode,
      setActivePanelId,
      setActiveAdminRouteId,
      setLastNonAdminLocation,
      setActiveCanvasDragNodeId,
      updateNode,
      upsertMediaAsset,
      removeMediaAsset,
      deleteMediaAsset,
      mediaPickerAvailable: mediaPicker !== undefined,
      ingestMediaFromPicker,
      updateDataBindings: (dataBindings: ComponentDataBindingRegistry) =>
        updateManifest((current) => updateStudioManifestDraftDataBindings(current, dataBindings)),
      updateDataSources: (dataSources: DataSourceRegistry) =>
        updateManifest((current) => updateStudioManifestDraftDataSources(current, dataSources)),
      deleteNode,
      insertFromCatalogEntry,
      moveNodeToPlacement: moveSelectedNodeToPlacement,
      addScreen,
      deleteScreen,
      setNavigatorType,
      setNavigatorInitialRoute,
      setRoutePrimaryNavigationVisibility,
      moveRoute,
      addTheme: noop,
      updateTheme,
      deleteTheme: noop,
      setActiveThemeId: noop,
      updateAuthSettings,
      mutateAuthSettings,
      updateOAuthProviders,
      setActiveScreenId,
      findNode: findNodeById,
      togglePreviewMode: () => setPreviewMode((current) => !current),
      refetchManifest: persistence.refetchManifest,
      flushManifest: persistence.flushManifest,
    }),
    [
      activeAdminRouteId,
      activeCanvasDragNodeId,
      activePanelId,
      activeScreenId,
      error,
      isLoading,
      lastNonAdminLocation,
      manifest,
      previewMode,
      projectId,
      rootNode,
      componentMeta,
      saveStatus,
      selectedNodeId,
      updateManifest,
      updateNode,
      upsertMediaAsset,
      removeMediaAsset,
      deleteMediaAsset,
      mediaPicker,
      ingestMediaFromPicker,
      updateAuthSettings,
      mutateAuthSettings,
      updateOAuthProviders,
      deleteNode,
      insertFromCatalogEntry,
      moveSelectedNodeToPlacement,
      addScreen,
      deleteScreen,
      setNavigatorType,
      setNavigatorInitialRoute,
      setRoutePrimaryNavigationVisibility,
      moveRoute,
      updateTheme,
      setActiveScreenId,
      persistence.refetchManifest,
      persistence.flushManifest,
    ],
  );

  return React.createElement(AuthAdminSessionProvider, {
    key: projectId,
    projectId,
    children: React.createElement(StudioContext.Provider, { value }, children),
  });
};

/***
 * Coordinate initial manifest hydration, debounced persistence, explicit flushes, and save-state reporting for StudioProvider.
 * @todo Move manifest persistence orchestration out of StudioProvider into the dedicated persistence responsibility.
 */
function useStudioManifestPersistence(args: {
  readonly projectId: string;
  readonly manifest: StudioManifest | null;
  readonly manifestRef: React.RefObject<StudioManifest | null>;
  readonly initialManifest: StudioManifest | null;
  readonly replaceManifest: (manifest: StudioManifest | null) => void;
  readonly setSaveStatus: React.Dispatch<React.SetStateAction<StudioContextValue['saveStatus']>>;
  readonly setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setError: React.Dispatch<React.SetStateAction<string | null>>;
}): { readonly refetchManifest: () => Promise<void>; readonly flushManifest: () => Promise<void> } {
  const {
    projectId,
    manifest,
    manifestRef,
    initialManifest,
    setError,
    setIsLoading,
    replaceManifest,
    setSaveStatus,
  } = args;
  const hydratedRef = useRef(false);
  const lastPersistedSignatureRef = useRef<string | null>(
    initialManifest ? createStudioManifestSignature(initialManifest) : null,
  );
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coordinatorRef = useRef<StudioManifestPersistenceCoordinator | null>(null);

  useEffect(() => {
    coordinatorRef.current = new StudioManifestPersistenceCoordinator({
      projectId,
      readManifest: () => manifestRef.current,
      readLastPersistedSignature: () => lastPersistedSignatureRef.current,
      setLastPersistedSignature: (signature) => {
        lastPersistedSignatureRef.current = signature;
      },
      saveManifest: persistProjectManifest,
      setSaveStatus,
      setError,
      toErrorMessage: toPersistenceMessage,
    });
    return () => {
      coordinatorRef.current = null;
    };
  }, [manifestRef, projectId, setError, setSaveStatus]);

  /*** Fetch the persisted project manifest and hydrate Studio save-state bookkeeping around it. */
  const loadManifest = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const loaded = await requestProjectManifest(projectId);
      const loadedSignature = createStudioManifestSignature(loaded);
      const currentManifest = manifestRef.current;
      if (!currentManifest || createStudioManifestSignature(currentManifest) !== loadedSignature) {
        replaceManifest(loaded);
      }
      lastPersistedSignatureRef.current = loadedSignature;
      setSaveStatus('saved');
    } catch (caught) {
      const fallbackSignature = initialManifest
        ? createStudioManifestSignature(initialManifest)
        : null;
      lastPersistedSignatureRef.current = fallbackSignature;
      setError(toPersistenceMessage(caught));
      setSaveStatus('error');
    } finally {
      hydratedRef.current = true;
      setIsLoading(false);
    }
  }, [
    initialManifest,
    manifestRef,
    projectId,
    replaceManifest,
    setError,
    setIsLoading,
    setSaveStatus,
  ]);

  useEffect(() => {
    void loadManifest();
  }, [loadManifest]);

  useEffect(() => {
    if (!hydratedRef.current || !manifest) return;
    const coordinator = coordinatorRef.current;
    if (!coordinator) return;

    const signature = createStudioManifestSignature(manifest);
    if (signature === lastPersistedSignatureRef.current) return;

    setSaveStatus('saving');
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      void coordinator.queueLatestSave().catch(() => undefined);
    }, STUDIO_MANIFEST_SAVE_DELAY_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [manifest, setSaveStatus]);

  /*** Cancel any pending debounce and persist the latest manifest immediately through the coordinator. */
  const flushManifest = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    await coordinatorRef.current?.flushLatestSave();
  }, []);

  return { refetchManifest: loadManifest, flushManifest };
}

/***
 * Fetch and parse the persisted Studio manifest for one project.
 * @todo Group project-manifest HTTP access in a dedicated manifest host client instead of StudioProvider.
 */
async function requestProjectManifest(projectId: string): Promise<StudioManifest> {
  const response = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectId)}/manifest`);
  const value = await readPersistenceJson(response);
  if (!response.ok) throw createPersistenceError(value, response.status);
  return value as StudioManifest;
}

/***
 * Persist the complete Studio manifest for one project through the host API.
 * @todo Group project-manifest HTTP access in a dedicated manifest host client instead of StudioProvider.
 */
async function persistProjectManifest(projectId: string, manifest: StudioManifest): Promise<void> {
  const response = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectId)}/manifest`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(manifest),
  });
  const value = await readPersistenceJson(response);
  if (!response.ok) throw createPersistenceError(value, response.status);
}

/***
 * Parse a persistence response body as JSON and convert invalid bodies into an explicit request error.
 * @todo Keep response parsing beside the dedicated project-manifest host client.
 */
async function readPersistenceJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error(`Project manifest request returned non-JSON status ${response.status}.`);
  }
}

/***
 * Convert an unsuccessful persistence response payload and HTTP status into an Error.
 * @todo Keep persistence response error policy beside the dedicated project-manifest host client.
 */
function createPersistenceError(value: unknown, status: number): Error {
  const record =
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const error = typeof record.error === 'string' ? record.error : `HTTP ${status}`;
  return new Error(error);
}

/*** Convert an unknown persistence failure into the message shown by Studio save-state UI. */
function toPersistenceMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Project manifest persistence failed.';
}
