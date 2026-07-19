import type {
  AppDataManifest,
  AuthOAuthProviderConfig,
  ComponentDataBindingRegistry,
  DataSourceRegistry,
  NavigatorType,
  RouteDefinition,
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
  findNodeById,
  type InsertCatalogEntry,
  type NodePlacement,
  type StudioAdminRouteId,
  type StudioContextValue,
  type StudioManifest,
  type StudioMode,
  type StudioModuleId,
  type StudioNodeId,
  type StudioPanelId,
  type StudioScreenId,
  type ThemeUpdates,
} from '../index';
import { createStudioManifestSignature } from '../manifestSync';
import { API_BASE } from './constants';
import { StudioContext } from './StudioContext';
import {
  applyStudioManifestDraftMutation,
  replaceStudioManifestDraftAuthSettings,
  updateStudioManifestDraftAppData,
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
}

const noop = () => undefined;
const noopAsync = () => Promise.resolve();
const STUDIO_MANIFEST_SAVE_DELAY_MS = 350;

const resolveActiveRootNode = (
  manifest: StudioManifest | null,
  activeScreenId: StudioScreenId | null,
): UiNode | null => {
  if (!manifest) {
    return null;
  }

  const route =
    manifest.navigator.routes.find((candidate) => candidate.screenId === activeScreenId) ??
    manifest.navigator.routes.find(
      (candidate) => candidate.name === manifest.navigator.initialRouteName,
    ) ??
    manifest.navigator.routes[0];

  const screenId = activeScreenId ?? route?.screenId;
  if (!screenId) {
    return null;
  }

  return manifest.screens[screenId]?.root ?? null;
};

export const StudioProvider = ({
  children,
  projectId,
  initialManifest = null,
}: StudioProviderProps) => {
  const [manifest, setManifest] = useState<StudioManifest | null>(initialManifest);
  const [activePanelId, setActivePanelId] = useState<StudioPanelId | null>(null);
  const [activeAdminRouteId, setActiveAdminRouteId] = useState<StudioAdminRouteId>('overview');
  const [activeCanvasDragNodeId, setActiveCanvasDragNodeId] = useState<StudioNodeId | null>(null);
  const [activeScreenId, setActiveScreenId] = useState<StudioScreenId | null>(null);
  const [selectedNodeId, selectNode] = useState<StudioNodeId | null>(null);
  const [lastNonAdminLocation, setLastNonAdminLocation] = useState('/');
  const [saveStatus, setSaveStatus] = useState<StudioContextValue['saveStatus']>('idle');
  const [isLoading, setIsLoading] = useState(initialManifest === null);
  const [error, setError] = useState<string | null>(null);
  const [studioMode, setStudioMode] = useState<StudioMode>('dark');
  const [previewMode, setPreviewMode] = useState(false);
  const [activeLocale, setActiveLocale] = useState('en');
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

  const rootNode = useMemo<UiNode | null>(
    () => resolveActiveRootNode(manifest, activeScreenId),
    [activeScreenId, manifest],
  );

  const updateNode = useCallback(
    (nodeId: StudioNodeId, props: Record<string, unknown>) => {
      updateManifest((current) => updateStudioManifestDraftNode(current, nodeId, props));
    },
    [updateManifest],
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

  const value = useMemo<StudioContextValue>(
    () => ({
      projectId,
      activeLocale,
      activeScreenId,
      selectedNodeId,
      activePanelId,
      activeAdminRouteId,
      activeCanvasDragNodeId,
      studioMode,
      previewMode,
      lastNonAdminLocation,
      saveStatus,
      isLoading,
      error,
      manifest,
      rootNode,
      selectNode,
      setActivePanelId,
      setActiveAdminRouteId,
      setLastNonAdminLocation,
      setActiveCanvasDragNodeId,
      updateNode,
      updateAppData: (data: AppDataManifest) =>
        updateManifest((current) => updateStudioManifestDraftAppData(current, data)),
      updateDataBindings: (dataBindings: ComponentDataBindingRegistry) =>
        updateManifest((current) => updateStudioManifestDraftDataBindings(current, dataBindings)),
      updateDataSources: (dataSources: DataSourceRegistry) =>
        updateManifest((current) => updateStudioManifestDraftDataSources(current, dataSources)),
      deleteNode: noop,
      insertFromCatalogEntry: (_entry: InsertCatalogEntry) => false,
      moveNodeToPlacement: (_nodeId: StudioNodeId, _placement: NodePlacement) => false,
      addScreen: noop,
      deleteScreen: noop,
      setNavigatorType: (_type: NavigatorType) => undefined,
      setNavigatorInitialRoute: noop,
      addTheme: noop,
      updateTheme,
      deleteTheme: noop,
      setActiveThemeId: noop,
      setActiveThemeMode: setStudioMode,
      updateAuthSettings,
      mutateAuthSettings,
      updateModuleConfig: (_moduleId: StudioModuleId, _config: Record<string, unknown>) =>
        undefined,
      updateOAuthProviders,
      moveNode: noop,
      reorderScreens: (_newRoutes: RouteDefinition[]) => undefined,
      setActiveScreenId,
      findNode: findNodeById,
      setStudioMode,
      togglePreviewMode: () => setPreviewMode((current) => !current),
      t: (key: string) => key,
      setActiveLocale,
      reloadDictionaries: noopAsync,
      refetchManifest: persistence.refetchManifest,
      flushManifest: persistence.flushManifest,
    }),
    [
      activeAdminRouteId,
      activeCanvasDragNodeId,
      activeLocale,
      activePanelId,
      activeScreenId,
      error,
      isLoading,
      lastNonAdminLocation,
      manifest,
      previewMode,
      projectId,
      rootNode,
      saveStatus,
      selectedNodeId,
      studioMode,
      updateManifest,
      updateNode,
      updateAuthSettings,
      mutateAuthSettings,
      updateOAuthProviders,
      updateTheme,
      persistence.refetchManifest,
      persistence.flushManifest,
    ],
  );

  return React.createElement(StudioContext.Provider, { value }, children);
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
  const coordinator = useMemo(
    () =>
      new StudioManifestPersistenceCoordinator({
        projectId,
        readManifest: () => manifestRef.current,
        readLastPersistedSignature: () => lastPersistedSignatureRef.current,
        setLastPersistedSignature: (signature) => {
          lastPersistedSignatureRef.current = signature;
        },
        saveManifest: saveStudioManifest,
        setSaveStatus,
        setError,
        toErrorMessage: toPersistenceMessage,
      }),
    [manifestRef, projectId, setError, setSaveStatus],
  );

  const loadManifest = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const loaded = await requestStudioManifest(projectId);
      replaceManifest(loaded);
      lastPersistedSignatureRef.current = createStudioManifestSignature(loaded);
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
  }, [initialManifest, projectId, replaceManifest, setError, setIsLoading, setSaveStatus]);

  useEffect(() => {
    void loadManifest();
  }, [loadManifest]);

  useEffect(() => {
    if (!hydratedRef.current || !manifest) return;

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
  }, [coordinator, manifest, setSaveStatus]);

  const flushManifest = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    await coordinator.flushLatestSave();
  }, [coordinator]);

  return { refetchManifest: loadManifest, flushManifest };
}

async function requestStudioManifest(projectId: string): Promise<StudioManifest> {
  const response = await fetch(
    `${API_BASE}/projects/${encodeURIComponent(projectId)}/studio/manifest`,
  );
  const value = await readPersistenceJson(response);
  if (!response.ok) throw createPersistenceError(value, response.status);
  return value as StudioManifest;
}

async function saveStudioManifest(projectId: string, manifest: StudioManifest): Promise<void> {
  const response = await fetch(
    `${API_BASE}/projects/${encodeURIComponent(projectId)}/studio/manifest`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(manifest),
    },
  );
  const value = await readPersistenceJson(response);
  if (!response.ok) throw createPersistenceError(value, response.status);
}

async function readPersistenceJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error(`Studio manifest request returned non-JSON status ${response.status}.`);
  }
}

function createPersistenceError(value: unknown, status: number): Error {
  const record =
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const error = typeof record.error === 'string' ? record.error : `HTTP ${status}`;
  return new Error(error);
}

function toPersistenceMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Studio manifest persistence failed.';
}
