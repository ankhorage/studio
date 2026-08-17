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

const noop = () => undefined;
const STUDIO_MANIFEST_SAVE_DELAY_MS = 350;

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
  const replaceManifest = useCallback((nextManifest: StudioManifest | null) => {
    manifestRef.current = nextManifest;
    setManifest(nextManifest);
  }, []);
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

  const updateNode = useCallback(
    (nodeId: StudioNodeId, props: Record<string, unknown>) => {
      updateManifest((current) => updateStudioManifestDraftNode(current, nodeId, props));
    },
    [updateManifest],
  );

  const upsertMediaAsset = useCallback(
    (asset: MediaAsset) => {
      updateManifest((current) => upsertStudioMediaAsset(current, asset));
    },
    [updateManifest],
  );

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

  const updateTheme = useCallback(
    (id: string, updates: ThemeUpdates) => {
      updateManifest((current) => updateStudioManifestDraftTheme(current, id, updates));
    },
    [updateManifest],
  );

  const updateAuthSettings = useCallback(
    (settings: StudioAuthSettings) => {
      updateManifest((current) => updateStudioManifestDraftAuthSettings(current, settings));
    },
    [updateManifest],
  );

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

  const setNavigatorType = useCallback(
    (type: NavigatorType) => {
      updateManifest((current) => setStudioManifestNavigatorType(current, type));
    },
    [updateManifest],
  );

  const setNavigatorInitialRoute = useCallback(
    (routeName: string) => {
      updateManifest((current) => setStudioManifestNavigatorInitialRoute(current, routeName));
    },
    [updateManifest],
  );

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

  const moveRoute = useCallback(
    (parentPath: string[], routeName: string, toIndex: number) => {
      updateManifest((current) =>
        moveStudioManifestRoute({ manifest: current, parentPath, routeName, toIndex }),
      );
    },
    [updateManifest],
  );

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

  const flushManifest = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    await coordinatorRef.current?.flushLatestSave();
  }, []);

  return { refetchManifest: loadManifest, flushManifest };
}

async function requestProjectManifest(projectId: string): Promise<StudioManifest> {
  const response = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectId)}/manifest`);
  const value = await readPersistenceJson(response);
  if (!response.ok) throw createPersistenceError(value, response.status);
  return value as StudioManifest;
}

async function persistProjectManifest(projectId: string, manifest: StudioManifest): Promise<void> {
  const response = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectId)}/manifest`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(manifest),
  });
  const value = await readPersistenceJson(response);
  if (!response.ok) throw createPersistenceError(value, response.status);
}

async function readPersistenceJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error(`Project manifest request returned non-JSON status ${response.status}.`);
  }
}

function createPersistenceError(value: unknown, status: number): Error {
  const record =
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const error = typeof record.error === 'string' ? record.error : `HTTP ${status}`;
  return new Error(error);
}

function toPersistenceMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Project manifest persistence failed.';
}
