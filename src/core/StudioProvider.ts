import React, { type ReactNode, useMemo, useState } from 'react';

import {
  findNodeById,
  type InsertCatalogEntry,
  type NodePlacement,
  type StudioAdminRoutePath,
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

type UiNode = import('@ankhorage/contracts').UiNode;
type AppDataManifest = import('@ankhorage/contracts').AppDataManifest;
type AuthOAuthProviderConfig = import('@ankhorage/contracts').AuthOAuthProviderConfig;
type ComponentDataBindingRegistry = import('@ankhorage/contracts').ComponentDataBindingRegistry;
type DataSourceRegistry = import('@ankhorage/contracts').DataSourceRegistry;
type NavigatorType = import('@ankhorage/contracts').NavigatorType;
type RouteDefinition = import('@ankhorage/contracts').RouteDefinition;

export interface StudioProviderProps {
  children: ReactNode;
  projectId: string;
  initialManifest?: StudioManifest | null;
}

function noop() {}
function noopAsync() {
  return Promise.resolve();
}

export const StudioProvider = ({ children, projectId, initialManifest = null }: StudioProviderProps) => {
  const [manifest, setManifest] = useState<StudioManifest | null>(initialManifest);
  const [activePanelId, setActivePanelId] = useState<StudioPanelId | null>(null);
  const [activeAdminRoutePath, setActiveAdminRoutePath] = useState<StudioAdminRoutePath>('/');
  const [activeCanvasDragNodeId, setActiveCanvasDragNodeId] = useState<StudioNodeId | null>(null);
  const [activeScreenId, setActiveScreenId] = useState<StudioScreenId | null>(null);
  const [selectedNodeId, selectNode] = useState<StudioNodeId | null>(null);
  const [studioMode, setStudioMode] = useState<StudioMode>('dark');
  const [previewMode, setPreviewMode] = useState(false);
  const [activeLocale, setActiveLocale] = useState('en');

  const rootNode = useMemo<UiNode | null>(() => {
    const routes = manifest?.routes as Array<{ id?: string; root?: UiNode }> | undefined;
    const route = routes?.find((candidate) => candidate.id === activeScreenId) ?? routes?.[0];
    return route?.root ?? null;
  }, [activeScreenId, manifest]);

  const value = useMemo<StudioContextValue>(
    () => ({
      projectId,
      activeLocale,
      activeScreenId,
      selectedNodeId,
      activePanelId,
      activeAdminRoutePath,
      activeCanvasDragNodeId,
      studioMode,
      previewMode,
      saveStatus: 'idle',
      isLoading: false,
      error: null,
      manifest,
      rootNode,
      selectNode,
      setActivePanelId,
      setActiveAdminRoutePath,
      setActiveCanvasDragNodeId,
      updateNode: noop,
      updateAppData: (data: AppDataManifest) => setManifest((current) => (current ? { ...current, data } : current)),
      updateDataBindings: (dataBindings: ComponentDataBindingRegistry) => setManifest((current) => (current ? { ...current, dataBindings } : current)),
      updateDataSources: (dataSources: DataSourceRegistry) => setManifest((current) => (current ? { ...current, dataSources } : current)),
      deleteNode: noop,
      insertFromCatalogEntry: (_entry: InsertCatalogEntry) => false,
      moveNodeToPlacement: (_nodeId: StudioNodeId, _placement: NodePlacement) => false,
      addScreen: noop,
      deleteScreen: noop,
      setNavigatorType: (_type: NavigatorType) => {},
      setNavigatorInitialRoute: noop,
      addTheme: noop,
      updateTheme: (_id: string, _updates: ThemeUpdates) => {},
      deleteTheme: noop,
      setActiveThemeId: noop,
      setActiveThemeMode: setStudioMode,
      updateModuleConfig: (_moduleId: StudioModuleId, _config: Record<string, unknown>) => {},
      updateOAuthProviders: (_providers: AuthOAuthProviderConfig[]) => {},
      moveNode: noop,
      reorderScreens: (_newRoutes: RouteDefinition[]) => {},
      setActiveScreenId,
      findNode: findNodeById,
      setStudioMode,
      togglePreviewMode: () => setPreviewMode((current) => !current),
      t: (key: string) => key,
      setActiveLocale,
      reloadDictionaries: noopAsync,
      refetchManifest: noopAsync,
    }),
    [activeAdminRoutePath, activeCanvasDragNodeId, activeLocale, activePanelId, activeScreenId, manifest, previewMode, projectId, rootNode, selectedNodeId, studioMode],
  );

  return React.createElement(StudioContext.Provider, { value }, children);
};
