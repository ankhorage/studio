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
  applyStudioAuthSettings,
  readStudioAuthSettings,
  type StudioAuthSettings,
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
import {
  findScreenIdForNode,
  updateStudioManifestAppData,
  updateStudioManifestDataBindings,
  updateStudioManifestDataSources,
  updateStudioManifestNode,
  updateStudioManifestTheme,
} from '../manifestState';
import { createStudioManifestSignature } from '../manifestSync';
import { API_BASE } from './constants';
import { StudioContext } from './StudioContext';

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
  const persistence = useStudioManifestPersistence({
    projectId,
    manifest,
    initialManifest,
    setManifest,
    setSaveStatus,
    setIsLoading,
    setError,
  });

  const rootNode = useMemo<UiNode | null>(
    () => resolveActiveRootNode(manifest, activeScreenId),
    [activeScreenId, manifest],
  );

  const updateNode = useCallback((nodeId: StudioNodeId, props: Record<string, unknown>) => {
    setManifest((current) => {
      if (!current) return current;
      const owningScreenId = findScreenIdForNode(current, nodeId);
      if (!owningScreenId) return current;
      return updateStudioManifestNode(current, owningScreenId, nodeId, props);
    });
  }, []);

  const updateTheme = useCallback((id: string, updates: ThemeUpdates) => {
    setManifest((current) => (current ? updateStudioManifestTheme(current, id, updates) : current));
  }, []);

  const updateAuthSettings = useCallback((settings: StudioAuthSettings) => {
    setManifest((current) => (current ? applyStudioAuthSettings(current, settings) : current));
  }, []);

  const updateOAuthProviders = useCallback((providers: AuthOAuthProviderConfig[]) => {
    setManifest((current) => {
      if (!current) return current;
      const currentAuth = readStudioAuthSettings(current);
      const nextAuth = currentAuth ?? {
        scope: 'none',
        provider: 'supabase',
        flow: { ...DEFAULT_AUTH_FLOW },
        signIn: { identifiers: ['email'] },
      };
      return applyStudioAuthSettings(current, {
        ...nextAuth,
        oauth: {
          enabled: nextAuth.oauth?.enabled ?? false,
          callbackRoute: nextAuth.oauth?.callbackRoute ?? '/auth/callback',
          providers,
        },
      });
    });
  }, []);

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
        setManifest((current) => (current ? updateStudioManifestAppData(current, data) : current)),
      updateDataBindings: (dataBindings: ComponentDataBindingRegistry) =>
        setManifest((current) =>
          current ? updateStudioManifestDataBindings(current, dataBindings) : current,
        ),
      updateDataSources: (dataSources: DataSourceRegistry) =>
        setManifest((current) =>
          current ? updateStudioManifestDataSources(current, dataSources) : current,
        ),
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
      updateNode,
      updateAuthSettings,
      updateOAuthProviders,
      updateTheme,
      persistence.refetchManifest,
    ],
  );

  return React.createElement(StudioContext.Provider, { value }, children);
};

function useStudioManifestPersistence(args: {
  readonly projectId: string;
  readonly manifest: StudioManifest | null;
  readonly initialManifest: StudioManifest | null;
  readonly setManifest: React.Dispatch<React.SetStateAction<StudioManifest | null>>;
  readonly setSaveStatus: React.Dispatch<React.SetStateAction<StudioContextValue['saveStatus']>>;
  readonly setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setError: React.Dispatch<React.SetStateAction<string | null>>;
}): { readonly refetchManifest: () => Promise<void> } {
  const {
    projectId,
    manifest,
    initialManifest,
    setError,
    setIsLoading,
    setManifest,
    setSaveStatus,
  } = args;
  const hydratedRef = useRef(false);
  const lastPersistedSignatureRef = useRef<string | null>(
    initialManifest ? createStudioManifestSignature(initialManifest) : null,
  );
  const saveInFlightRef = useRef(false);
  const pendingSaveRef = useRef<StudioManifest | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadManifest = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const loaded = await requestStudioManifest(projectId);
      setManifest(loaded);
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
  }, [initialManifest, projectId, setError, setIsLoading, setManifest, setSaveStatus]);

  const saveNext = useCallback(async () => {
    if (saveInFlightRef.current) return;
    const nextManifest = pendingSaveRef.current;
    if (!nextManifest) return;

    pendingSaveRef.current = null;
    saveInFlightRef.current = true;
    setSaveStatus('saving');
    try {
      await saveStudioManifest(projectId, nextManifest);
      lastPersistedSignatureRef.current = createStudioManifestSignature(nextManifest);
      setError(null);
      setSaveStatus('saved');
    } catch (caught) {
      setError(toPersistenceMessage(caught));
      setSaveStatus('error');
    } finally {
      saveInFlightRef.current = false;
      if (hasPendingStudioManifest(pendingSaveRef)) {
        void saveNext();
      }
    }
  }, [projectId, setError, setSaveStatus]);

  useEffect(() => {
    void loadManifest();
  }, [loadManifest]);

  useEffect(() => {
    if (!hydratedRef.current || !manifest) return;

    const signature = createStudioManifestSignature(manifest);
    if (signature === lastPersistedSignatureRef.current) return;

    pendingSaveRef.current = manifest;
    setSaveStatus('saving');
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      void saveNext();
    }, STUDIO_MANIFEST_SAVE_DELAY_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [manifest, saveNext, setSaveStatus]);

  return { refetchManifest: loadManifest };
}

function hasPendingStudioManifest(ref: React.RefObject<StudioManifest | null>): boolean {
  return ref.current !== null;
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
