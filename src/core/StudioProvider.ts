import type {
  AppDataManifest,
  AuthOAuthProviderConfig,
  ComponentDataBindingRegistry,
  DataSourceRegistry,
  NavigatorType,
  RouteDefinition,
  UiNode,
} from '@ankhorage/contracts';
import React, { type ReactNode, useMemo, useState } from 'react';

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
import { StudioContext } from './StudioContext';

export interface StudioProviderProps {
  children: ReactNode;
  projectId: string;
  initialManifest?: StudioManifest | null;
}

const noop = () => undefined;
const noopAsync = () => Promise.resolve();

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
  const [studioMode, setStudioMode] = useState<StudioMode>('dark');
  const [previewMode, setPreviewMode] = useState(false);
  const [activeLocale, setActiveLocale] = useState('en');

  const rootNode = useMemo<UiNode | null>(
    () => resolveActiveRootNode(manifest, activeScreenId),
    [activeScreenId, manifest],
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
      saveStatus: 'idle',
      isLoading: false,
      error: null,
      manifest,
      rootNode,
      selectNode,
      setActivePanelId,
      setActiveAdminRouteId,
      setLastNonAdminLocation,
      setActiveCanvasDragNodeId,
      updateNode: noop,
      updateAppData: (data: AppDataManifest) =>
        setManifest((current) => (current ? { ...current, data } : current)),
      updateDataBindings: (dataBindings: ComponentDataBindingRegistry) =>
        setManifest((current) => (current ? { ...current, dataBindings } : current)),
      updateDataSources: (dataSources: DataSourceRegistry) =>
        setManifest((current) => (current ? { ...current, dataSources } : current)),
      deleteNode: noop,
      insertFromCatalogEntry: (_entry: InsertCatalogEntry) => false,
      moveNodeToPlacement: (_nodeId: StudioNodeId, _placement: NodePlacement) => false,
      addScreen: noop,
      deleteScreen: noop,
      setNavigatorType: (_type: NavigatorType) => undefined,
      setNavigatorInitialRoute: noop,
      addTheme: noop,
      updateTheme: (_id: string, _updates: ThemeUpdates) => undefined,
      deleteTheme: noop,
      setActiveThemeId: noop,
      setActiveThemeMode: setStudioMode,
      updateModuleConfig: (_moduleId: StudioModuleId, _config: Record<string, unknown>) =>
        undefined,
      updateOAuthProviders: (_providers: AuthOAuthProviderConfig[]) => undefined,
      moveNode: noop,
      reorderScreens: (_newRoutes: RouteDefinition[]) => undefined,
      setActiveScreenId,
      findNode: findNodeById,
      setStudioMode,
      togglePreviewMode: () => setPreviewMode((current) => !current),
      t: (key: string) => key,
      setActiveLocale,
      reloadDictionaries: noopAsync,
      refetchManifest: noopAsync,
    }),
    [
      activeAdminRouteId,
      activeCanvasDragNodeId,
      activeLocale,
      activePanelId,
      activeScreenId,
      lastNonAdminLocation,
      manifest,
      previewMode,
      projectId,
      rootNode,
      selectedNodeId,
      studioMode,
    ],
  );

  return React.createElement(StudioContext.Provider, { value }, children);
};
