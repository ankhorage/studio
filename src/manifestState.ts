import type {
  AppDataManifest,
  AuthOAuthProviderConfig,
  ComponentDataBindingRegistry,
  DataSourceRegistry,
  NavigatorSpec,
  NavigatorType,
  RouteDefinition,
  ThemeConfig,
  UiNode,
} from '@ankhorage/contracts';

import type {
  NodePlacement,
  StudioComponentMetaRegistry,
  StudioIdGenerator,
  StudioManifest,
  StudioMode,
  ThemeUpdates,
} from './index';

export interface ScreenRouteEntry {
  route: RouteDefinition;
  screenId: string;
  parentPath: string[];
  routePath: string[];
}

export interface ScreenRouteGroup {
  id: string;
  parentPath: string[];
  entries: ScreenRouteEntry[];
}

export interface StudioManifestScreenMutationResult {
  manifest: StudioManifest;
  activeScreenId: string | null;
}

export interface StudioManifestNodeInsertResult {
  manifest: StudioManifest;
  insertedNodeId: string;
}

export interface StudioManifestNodeMoveResult {
  manifest: StudioManifest;
  movedNodeId: string;
}

export const DEFAULT_STUDIO_SCREEN_TEMPLATE: UiNode = {
  id: 'tpl-screen-empty',
  type: 'Screen',
  props: {
    width: 'wide',
  },
  children: [
    {
      id: 'tpl-screen-empty-header',
      type: 'SectionHeader',
      props: {
        title: 'New Screen',
        description: 'Start authoring with ZORA layouts and patterns.',
      },
    },
    {
      id: 'tpl-screen-empty-section',
      type: 'ScreenSection',
      props: {
        title: 'Build the first section',
        description: 'Insert panels, forms, or content patterns to start authoring.',
      },
      children: [
        {
          id: 'tpl-screen-empty-state',
          type: 'EmptyState',
          props: {
            title: 'Canvas is ready',
            description: 'Use Insert to add components and layouts.',
          },
        },
      ],
    },
    {
      id: 'tpl-screen-empty-action',
      type: 'Button',
      props: {
        children: 'Add first section',
        tone: 'primary',
        emphasis: 'solid',
      },
    },
  ],
};

export const generateManifestStateId: StudioIdGenerator = (prefix?: string): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 11);
  const id = `${timestamp}-${random}`;
  return prefix ? `${prefix.toLowerCase()}-${id}` : id;
};

export function createStudioManifestFingerprint(manifest: StudioManifest | null): string {
  if (!manifest) return '';

  return JSON.stringify({
    navigator: manifest.navigator,
    screens: Object.keys(manifest.screens),
    data: manifest.data ?? {},
    dataBindings: Object.keys(manifest.dataBindings ?? {}),
    dataSources: Object.keys(manifest.dataSources ?? {}),
    themes: manifest.themes.map((theme) => theme.id),
    activeThemeId: manifest.activeThemeId,
    activeThemeMode: manifest.activeThemeMode,
    settings: manifest.settings,
    infra: manifest.infra,
  });
}

export function pathToKey(path: string[]): string {
  return path.length === 0 ? '__root__' : path.join('/');
}

export function isRouteGroupSegment(segment: string): boolean {
  return /^\(.*\)$/.test(segment);
}

export function collectScreenRouteEntries(
  routes: RouteDefinition[],
  parentPath: string[] = [],
  routePathPrefix: string[] = [],
): ScreenRouteEntry[] {
  const entries: ScreenRouteEntry[] = [];

  for (const route of routes) {
    const routePath = [...routePathPrefix, route.name];
    if (route.screenId) {
      entries.push({
        route,
        screenId: route.screenId,
        parentPath,
        routePath,
      });
    }

    if (route.navigator?.routes.length) {
      entries.push(...collectScreenRouteEntries(route.navigator.routes, routePath, routePath));
    }
  }

  return entries;
}

export function groupScreenRouteEntries(entries: ScreenRouteEntry[]): ScreenRouteGroup[] {
  const groups = new Map<string, ScreenRouteGroup>();

  for (const entry of entries) {
    const key = pathToKey(entry.parentPath);
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        parentPath: entry.parentPath,
        entries: [],
      });
    }

    groups.get(key)?.entries.push(entry);
  }

  return Array.from(groups.values());
}

export function listScreenIdsInRouteOrder(routes: RouteDefinition[]): string[] {
  return collectScreenRouteEntries(routes).map((entry) => entry.screenId);
}

export function resolveInitialActiveScreenId(manifest: StudioManifest | null): string | null {
  if (!manifest) return null;

  const firstRoutedScreenId = listScreenIdsInRouteOrder(manifest.navigator.routes).find(
    (screenId) => !!manifest.screens[screenId],
  );
  const [firstScreenId] = Object.keys(manifest.screens);
  return firstRoutedScreenId ?? firstScreenId ?? null;
}

export function resolveActiveRootNode(
  manifest: StudioManifest | null,
  activeScreenId: string | null,
): UiNode | null {
  if (!manifest || !activeScreenId) return null;
  return manifest.screens[activeScreenId]?.root ?? null;
}

export function findNodeInManifest(root: UiNode, id: string): UiNode | null {
  if (root.id === id) return root;

  for (const child of root.children ?? []) {
    const nested = findNodeInManifest(child, id);
    if (nested) return nested;
  }

  return null;
}

export function resolveSafeSelectedNodeId(
  rootNode: UiNode | null,
  selectedNodeId: string | null,
): string | null {
  if (!selectedNodeId || !rootNode) return null;
  return findNodeInManifest(rootNode, selectedNodeId) ? selectedNodeId : null;
}

export function findScreenIdForNode(
  manifest: StudioManifest,
  nodeId: string,
): string | null {
  for (const [screenId, screen] of Object.entries(manifest.screens)) {
    if (findNodeInManifest(screen.root, nodeId)) {
      return screenId;
    }
  }

  return null;
}

export function updateStudioManifestNode(
  manifest: StudioManifest,
  activeScreenId: string | null,
  nodeId: string,
  newProps: Record<string, unknown>,
): StudioManifest {
  if (!activeScreenId) return manifest;
  const screen = manifest.screens[activeScreenId];
  if (!screen) return manifest;

  const newRoot = updateNodeInManifestTree(screen.root, nodeId, newProps);
  if (newRoot === screen.root) return manifest;

  return {
    ...manifest,
    screens: {
      ...manifest.screens,
      [activeScreenId]: {
        ...screen,
        root: newRoot,
      },
    },
  };
}

export function deleteStudioManifestNode(
  manifest: StudioManifest,
  activeScreenId: string | null,
  nodeId: string,
): StudioManifest {
  if (!activeScreenId) return manifest;
  const screen = manifest.screens[activeScreenId];
  if (!screen || screen.root.id === nodeId) return manifest;

  const newRoot = removeNodeFromManifestTree(screen.root, nodeId);
  if (!newRoot || newRoot === screen.root) return manifest;

  const nextDataBindings = Object.fromEntries(
    Object.entries(manifest.dataBindings ?? {}).filter(([componentId]) => componentId !== nodeId),
  );

  return {
    ...manifest,
    dataBindings: nextDataBindings,
    screens: {
      ...manifest.screens,
      [activeScreenId]: {
        ...screen,
        root: newRoot,
      },
    },
  };
}

export function moveStudioManifestNode(
  manifest: StudioManifest,
  activeScreenId: string | null,
  nodeId: string,
  direction: 'up' | 'down',
): StudioManifest {
  if (!activeScreenId) return manifest;
  const screen = manifest.screens[activeScreenId];
  if (!screen) return manifest;

  const newRoot = moveNodeInManifestTree(screen.root, nodeId, direction);
  if (newRoot === screen.root) return manifest;

  return {
    ...manifest,
    screens: {
      ...manifest.screens,
      [activeScreenId]: {
        ...screen,
        root: newRoot,
      },
    },
  };
}

export function insertStudioManifestNodeAtPlacement(args: {
  manifest: StudioManifest;
  activeScreenId: string | null;
  placement: NodePlacement;
  newNode: UiNode;
  componentMeta: StudioComponentMetaRegistry;
}): StudioManifestNodeInsertResult | null {
  const { manifest, activeScreenId, placement, newNode, componentMeta } = args;
  if (!activeScreenId) return null;
  const screen = manifest.screens[activeScreenId];
  if (!screen) return null;
  if (!validateManifestNodePlacement(screen.root, placement, newNode.type, componentMeta)) return null;

  const insertion = insertChildAtIndex({
    node: screen.root,
    parentId: placement.parentId,
    index: placement.index,
    newNode,
  });
  if (!insertion.inserted) return null;

  return {
    manifest: {
      ...manifest,
      screens: {
        ...manifest.screens,
        [activeScreenId]: {
          ...screen,
          root: insertion.node,
        },
      },
    },
    insertedNodeId: newNode.id,
  };
}

export function moveStudioManifestNodeToPlacement(args: {
  manifest: StudioManifest;
  activeScreenId: string | null;
  nodeId: string;
  placement: NodePlacement;
  componentMeta: StudioComponentMetaRegistry;
}): StudioManifestNodeMoveResult | null {
  const { manifest, activeScreenId, nodeId, placement, componentMeta } = args;
  if (!activeScreenId) return null;
  const screen = manifest.screens[activeScreenId];
  if (!screen) return null;

  const source = findNodeWithParent(screen.root, nodeId);
  if (!source?.parent) return null;
  if (placement.parentId === nodeId) return null;
  if (isDescendantNode(source.node, placement.parentId)) return null;

  const adjustedPlacement = adjustMovePlacement({ source, placement });
  if (!adjustedPlacement) return null;

  const removed = removeNodeForMove({ node: screen.root, nodeId });
  if (!removed.removedNode) return null;
  if (
    !validateManifestNodePlacement(
      removed.node,
      adjustedPlacement,
      removed.removedNode.type,
      componentMeta,
    )
  ) {
    return null;
  }

  const inserted = insertChildAtIndex({
    node: removed.node,
    parentId: adjustedPlacement.parentId,
    index: adjustedPlacement.index,
    newNode: removed.removedNode,
  });
  if (!inserted.inserted) return null;

  return {
    manifest: {
      ...manifest,
      screens: {
        ...manifest.screens,
        [activeScreenId]: {
          ...screen,
          root: inserted.node,
        },
      },
    },
    movedNodeId: removed.removedNode.id,
  };
}

export function updateStudioManifestAppData(
  manifest: StudioManifest,
  data: AppDataManifest,
): StudioManifest {
  return { ...manifest, data };
}

export function updateStudioManifestDataBindings(
  manifest: StudioManifest,
  dataBindings: ComponentDataBindingRegistry,
): StudioManifest {
  return { ...manifest, dataBindings };
}

export function updateStudioManifestDataSources(
  manifest: StudioManifest,
  dataSources: DataSourceRegistry,
): StudioManifest {
  return { ...manifest, dataSources };
}

export function createDefaultThemeConfig(
  themeIndex: number,
  id = generateManifestStateId('theme'),
): ThemeConfig {
  return {
    id,
    name: `New Theme ${themeIndex + 1}`,
    light: {
      primaryColor: '#3B82F6',
      harmony: 'monochromatic',
    },
    dark: {
      primaryColor: '#3B82F6',
      harmony: 'monochromatic',
    },
  };
}

export function addStudioManifestTheme(
  manifest: StudioManifest,
  theme = createDefaultThemeConfig(manifest.themes.length),
): StudioManifest {
  return { ...manifest, themes: [...manifest.themes, theme] };
}

export function updateStudioManifestTheme(
  manifest: StudioManifest,
  themeId: string,
  updates: ThemeUpdates,
): StudioManifest {
  return {
    ...manifest,
    themes: manifest.themes.map((theme) => {
      if (theme.id !== themeId) return theme;

      return {
        ...theme,
        ...(updates.name ? { name: updates.name } : {}),
        ...(updates.light ? { light: { ...theme.light, ...updates.light } } : {}),
        ...(updates.dark ? { dark: { ...theme.dark, ...updates.dark } } : {}),
      };
    }),
  };
}

export function deleteStudioManifestTheme(
  manifest: StudioManifest,
  themeId: string,
): StudioManifest {
  if (manifest.themes.length <= 1) return manifest;

  const themes = manifest.themes.filter((theme) => theme.id !== themeId);
  const activeThemeId =
    manifest.activeThemeId === themeId ? (themes[0]?.id ?? manifest.activeThemeId) : manifest.activeThemeId;

  return { ...manifest, themes, activeThemeId };
}

export function setStudioManifestActiveThemeId(
  manifest: StudioManifest,
  activeThemeId: string,
): StudioManifest {
  return { ...manifest, activeThemeId };
}

export function setStudioManifestActiveThemeMode(
  manifest: StudioManifest,
  activeThemeMode: StudioMode,
): StudioManifest {
  return { ...manifest, activeThemeMode };
}

export function updateStudioManifestModuleConfig(
  manifest: StudioManifest,
  moduleId: string,
  config: Record<string, unknown>,
): StudioManifest {
  const previousModuleConfig = manifest.infra.modulesConfig?.[moduleId];
  const updatedModuleConfig = {
    ...manifest.infra.modulesConfig,
    [moduleId]: {
      ...(typeof previousModuleConfig === 'object' && previousModuleConfig !== null
        ? previousModuleConfig
        : {}),
      ...config,
    },
  };

  let nextManifest: StudioManifest = {
    ...manifest,
    infra: {
      ...manifest.infra,
      modulesConfig: updatedModuleConfig,
    },
  };

  if (moduleId === 'expo-localization') {
    const previousLocalization = manifest.settings.localization;
    const nextLocalization = { ...previousLocalization };
    let hasLocalizationUpdate = false;

    if (typeof config.defaultLocale === 'string') {
      nextLocalization.defaultLocale = config.defaultLocale;
      hasLocalizationUpdate = true;
    }

    if (
      Array.isArray(config.locales) &&
      config.locales.every((locale: unknown) => typeof locale === 'string')
    ) {
      nextLocalization.locales = config.locales;
      hasLocalizationUpdate = true;
    }

    if (hasLocalizationUpdate) {
      nextManifest = {
        ...nextManifest,
        settings: {
          ...manifest.settings,
          localization: nextLocalization,
        },
      };
    }
  }

  return nextManifest;
}

export function updateStudioManifestOAuthProviders(
  manifest: StudioManifest,
  providers: AuthOAuthProviderConfig[],
): StudioManifest {
  const previousAuth = manifest.infra.auth ?? {
    provider: 'supabase',
    scope: 'global' as const,
    authorization: { kind: 'ABAC' as const, engine: 'cerbos' as const },
  };
  const previousOauth = previousAuth.oauth ?? {
    enabled: true,
    callbackRoute: '/auth/callback',
    providers: [],
  };

  return {
    ...manifest,
    infra: {
      ...manifest.infra,
      auth: {
        ...previousAuth,
        oauth: {
          ...previousOauth,
          enabled: providers.length > 0,
          providers,
        },
      },
    },
  };
}

export function getPrimaryNavigatorPath(routes: RouteDefinition[]): string[] {
  const appGroupRoute = routes.find((route) => route.name === '(app)' && route.navigator?.routes);
  if (appGroupRoute) return ['(app)'];

  const appRoute = routes.find((route) => route.name === 'app' && route.navigator?.routes);
  if (appRoute) return ['app'];

  return [];
}

export function findParentPathForScreenId(
  routes: RouteDefinition[],
  screenId: string,
  parentPath: string[] = [],
  routePathPrefix: string[] = [],
): string[] | null {
  for (const route of routes) {
    const routePath = [...routePathPrefix, route.name];
    if (route.screenId === screenId) return parentPath;
    if (route.navigator?.routes.length) {
      const nested = findParentPathForScreenId(route.navigator.routes, screenId, routePath, routePath);
      if (nested) return nested;
    }
  }

  return null;
}

export function findRoutesAtParentPath(
  routes: RouteDefinition[],
  parentPath: string[],
): RouteDefinition[] | null {
  if (parentPath.length === 0) return routes;

  const [segment, ...rest] = parentPath;
  if (!segment) return null;
  const route = routes.find((item) => item.name === segment);
  if (!route?.navigator?.routes) return null;

  return findRoutesAtParentPath(route.navigator.routes, rest);
}

export function insertRouteAtParentPath(
  routes: RouteDefinition[],
  parentPath: string[],
  newRoute: RouteDefinition,
): RouteDefinition[] {
  if (parentPath.length === 0) return [...routes, newRoute];

  const [segment, ...rest] = parentPath;
  return routes.map((route) => {
    if (route.name !== segment || !route.navigator?.routes) return route;

    return {
      ...route,
      navigator: {
        ...route.navigator,
        routes: insertRouteAtParentPath(route.navigator.routes, rest, newRoute),
      },
    };
  });
}

export function findNavigatorAtPath(
  navigator: NavigatorSpec,
  parentPath: string[],
): NavigatorSpec | null {
  if (parentPath.length === 0) return navigator;

  const [segment, ...rest] = parentPath;
  if (!segment) return null;
  const route = navigator.routes.find((item) => item.name === segment);
  if (!route?.navigator) return null;

  return findNavigatorAtPath(route.navigator, rest);
}

export function updateNavigatorAtPath(
  navigator: NavigatorSpec,
  parentPath: string[],
  updater: (current: NavigatorSpec) => NavigatorSpec,
): NavigatorSpec {
  if (parentPath.length === 0) return updater(navigator);

  const [segment, ...rest] = parentPath;
  return {
    ...navigator,
    routes: navigator.routes.map((route) => {
      if (route.name !== segment || !route.navigator) return route;

      return {
        ...route,
        navigator: updateNavigatorAtPath(route.navigator, rest, updater),
      };
    }),
  };
}

export function setStudioManifestNavigatorType(
  manifest: StudioManifest,
  type: NavigatorType,
): StudioManifest {
  const primaryNavigatorPath = getPrimaryNavigatorPath(manifest.navigator.routes);
  const currentNavigator = findNavigatorAtPath(manifest.navigator, primaryNavigatorPath);
  if (!currentNavigator || currentNavigator.type === type) return manifest;

  return {
    ...manifest,
    navigator: updateNavigatorAtPath(manifest.navigator, primaryNavigatorPath, (current) => ({
      ...current,
      type,
    })),
  };
}

export function setStudioManifestNavigatorInitialRoute(
  manifest: StudioManifest,
  routeName: string,
): StudioManifest {
  const normalizedRoute = routeName.trim();
  if (!normalizedRoute) return manifest;

  const primaryNavigatorPath = getPrimaryNavigatorPath(manifest.navigator.routes);
  const currentNavigator = findNavigatorAtPath(manifest.navigator, primaryNavigatorPath);
  if (!currentNavigator) return manifest;
  if (!currentNavigator.routes.some((route) => route.name === normalizedRoute)) return manifest;
  if (currentNavigator.initialRouteName === normalizedRoute) return manifest;

  return {
    ...manifest,
    navigator: updateNavigatorAtPath(manifest.navigator, primaryNavigatorPath, (current) => ({
      ...current,
      initialRouteName: normalizedRoute,
    })),
  };
}

export function addStudioManifestScreen(args: {
  manifest: StudioManifest;
  name: string;
  activeScreenId: string | null;
  createId?: StudioIdGenerator;
  screenTemplate?: UiNode;
}): StudioManifestScreenMutationResult {
  const { manifest, activeScreenId, createId = generateManifestStateId } = args;
  const trimmedName = args.name.trim();
  if (!trimmedName) return { manifest, activeScreenId };

  const baseRouteName = normalizeRouteName(trimmedName);
  const activeParentPath = activeScreenId
    ? findParentPathForScreenId(manifest.navigator.routes, activeScreenId)
    : null;
  const fallbackParentPath = getPrimaryNavigatorPath(manifest.navigator.routes);
  const activeParentRoutes =
    activeParentPath !== null ? findRoutesAtParentPath(manifest.navigator.routes, activeParentPath) : null;
  const parentPath = activeParentPath && activeParentRoutes ? activeParentPath : fallbackParentPath;
  const siblingRoutes = findRoutesAtParentPath(manifest.navigator.routes, parentPath) ?? [];

  let screenId = createId('Screen');
  while (manifest.screens[screenId]) {
    screenId = createId('Screen');
  }

  const existingPatterns = new Set(
    collectScreenRouteEntries(manifest.navigator.routes).map((entry) =>
      toCanonicalRoutePattern(entry.routePath),
    ),
  );
  const routeName = makeUniqueRouteNameForParent(
    baseRouteName,
    siblingRoutes,
    parentPath,
    existingPatterns,
  );

  const newScreen = {
    id: screenId,
    name: trimmedName,
    title: trimmedName,
    root: cloneNodeWithNewIds(args.screenTemplate ?? DEFAULT_STUDIO_SCREEN_TEMPLATE, createId),
  };

  return {
    activeScreenId: screenId,
    manifest: {
      ...manifest,
      screens: {
        ...manifest.screens,
        [screenId]: newScreen,
      },
      navigator: {
        ...manifest.navigator,
        routes: insertRouteAtParentPath(manifest.navigator.routes, parentPath, {
          name: routeName,
          label: trimmedName,
          screenId,
        }),
      },
    },
  };
}

export function deleteStudioManifestScreen(
  manifest: StudioManifest,
  screenId: string,
  activeScreenId: string | null,
): StudioManifestScreenMutationResult {
  if (Object.keys(manifest.screens).length <= 1) return { manifest, activeScreenId };

  const { [screenId]: _deletedScreen, ...remainingScreens } = manifest.screens;
  const remainingScreenIds = Object.keys(remainingScreens);
  let safeRoutes = removeScreenIdFromRoutes(manifest.navigator.routes, screenId);

  if (safeRoutes.length === 0 && remainingScreenIds.length > 0) {
    const fallbackScreenId = remainingScreenIds[0];
    if (!fallbackScreenId) return { manifest, activeScreenId };
    const fallbackScreen = remainingScreens[fallbackScreenId];
    safeRoutes = [
      {
        name: makeUniqueSiblingRouteName('screen', []),
        label: fallbackScreen?.name ?? 'Screen',
        screenId: fallbackScreenId,
      },
    ];
  }

  const orderedScreenIds = listScreenIdsInRouteOrder(safeRoutes).filter(
    (id) => !!remainingScreens[id],
  );
  const nextActiveScreenId =
    !activeScreenId || activeScreenId === screenId || !remainingScreens[activeScreenId]
      ? (orderedScreenIds[0] ?? remainingScreenIds[0] ?? null)
      : activeScreenId;

  return {
    activeScreenId: nextActiveScreenId,
    manifest: {
      ...manifest,
      screens: remainingScreens,
      navigator: {
        ...manifest.navigator,
        routes: safeRoutes,
      },
    },
  };
}

export function reorderStudioManifestScreens(
  manifest: StudioManifest,
  newRoutes: RouteDefinition[],
): StudioManifest {
  return {
    ...manifest,
    navigator: {
      ...manifest.navigator,
      routes: newRoutes,
    },
  };
}

export function removeScreenIdFromRoutes(
  routes: RouteDefinition[],
  screenId: string,
): RouteDefinition[] {
  const nextRoutes: RouteDefinition[] = [];

  for (const route of routes) {
    const nextRoute: RouteDefinition = { ...route };

    if (nextRoute.screenId === screenId) {
      delete nextRoute.screenId;
    }

    if (nextRoute.navigator?.routes) {
      const nextNested = removeScreenIdFromRoutes(nextRoute.navigator.routes, screenId);
      if (nextNested.length === 0) {
        delete nextRoute.navigator;
      } else {
        nextRoute.navigator = normalizeNavigatorAfterRouteUpdate({
          ...nextRoute.navigator,
          routes: nextNested,
        });
      }
    }

    if (!nextRoute.screenId && !nextRoute.navigator) continue;
    nextRoutes.push(nextRoute);
  }

  return nextRoutes;
}

export function makeUniqueSiblingRouteName(base: string, siblingRoutes: RouteDefinition[]): string {
  const normalized = normalizeRouteName(base);
  const existingNames = new Set(siblingRoutes.map((route) => route.name));
  if (!existingNames.has(normalized)) return normalized;

  let suffix = 2;
  while (existingNames.has(`${normalized}-${suffix}`)) {
    suffix += 1;
  }

  return `${normalized}-${suffix}`;
}

export function toCanonicalRoutePattern(routePath: string[]): string {
  const normalized = routePath.filter((segment) => !isRouteGroupSegment(segment));
  while (normalized[0] === 'index') normalized.shift();
  while (normalized.at(-1) === 'index') normalized.pop();
  return normalized.length ? `/${normalized.join('/')}` : '/';
}

export function makeUniqueRouteNameForParent(
  baseRouteName: string,
  siblingRoutes: RouteDefinition[],
  parentPath: string[],
  existingPatterns: Set<string>,
): string {
  const siblingNames = new Set(siblingRoutes.map((route) => route.name));
  let candidate = baseRouteName;
  let suffix = 2;

  while (
    siblingNames.has(candidate) ||
    existingPatterns.has(toCanonicalRoutePattern([...parentPath, candidate]))
  ) {
    candidate = `${baseRouteName}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function normalizeRouteName(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'screen'
  );
}

function cloneNodeWithNewIds(node: UiNode, createId: StudioIdGenerator): UiNode {
  const clonedNode: UiNode = {
    ...node,
    id: createId(node.type),
    props: node.props ? { ...node.props } : node.props,
  };

  if (node.children) {
    clonedNode.children = node.children.map((child) => cloneNodeWithNewIds(child, createId));
  }

  return clonedNode;
}

function updateNodeInManifestTree(
  root: UiNode,
  id: string,
  newProps: Record<string, unknown>,
): UiNode {
  if (root.id === id) {
    const { alias, style, ...rest } = newProps;
    const aliasUpdate = typeof alias === 'string' ? { alias } : {};
    const styleUpdate = isStyleRecord(style) ? { style } : {};

    return {
      ...root,
      ...aliasUpdate,
      ...styleUpdate,
      props: { ...(root.props ?? {}), ...rest },
    };
  }

  if (!root.children) return root;

  const nextChildren = root.children.map((child) => updateNodeInManifestTree(child, id, newProps));
  const hasChanged = nextChildren.some((child, index) => child !== root.children?.[index]);
  return hasChanged ? { ...root, children: nextChildren } : root;
}

function removeNodeFromManifestTree(root: UiNode, nodeId: string): UiNode | null {
  if (root.id === nodeId) return null;
  if (!root.children) return root;

  const filteredChildren = root.children.filter((child) => child.id !== nodeId);
  if (filteredChildren.length !== root.children.length) {
    return { ...root, children: filteredChildren };
  }

  const nextChildren = root.children.map((child) => removeNodeFromManifestTree(child, nodeId) ?? child);
  const hasChanged = nextChildren.some((child, index) => child !== root.children?.[index]);
  return hasChanged ? { ...root, children: nextChildren } : root;
}

function moveNodeInManifestTree(root: UiNode, nodeId: string, direction: 'up' | 'down'): UiNode {
  if (root.id === nodeId || !root.children) return root;

  const index = root.children.findIndex((child) => child.id === nodeId);
  if (index !== -1) {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= root.children.length) return root;

    const currentNode = root.children[index];
    const targetNode = root.children[targetIndex];
    if (!currentNode || !targetNode) return root;

    const nextChildren = [...root.children];
    nextChildren[index] = targetNode;
    nextChildren[targetIndex] = currentNode;
    return { ...root, children: nextChildren };
  }

  const nextChildren = root.children.map((child) => moveNodeInManifestTree(child, nodeId, direction));
  const hasChanged = nextChildren.some((child, childIndex) => child !== root.children?.[childIndex]);
  return hasChanged ? { ...root, children: nextChildren } : root;
}

interface NodeWithParent {
  node: UiNode;
  parent: UiNode | null;
  index: number;
}

function findNodeWithParent(root: UiNode, nodeId: string): NodeWithParent | null {
  if (root.id === nodeId) return { node: root, parent: null, index: -1 };

  const visit = (node: UiNode): NodeWithParent | null => {
    const children = node.children ?? [];
    for (const [index, child] of children.entries()) {
      if (child.id === nodeId) return { node: child, parent: node, index };

      const nested = visit(child);
      if (nested) return nested;
    }

    return null;
  };

  return visit(root);
}

function validateManifestNodePlacement(
  root: UiNode,
  placement: NodePlacement,
  childType: string,
  componentMeta: StudioComponentMetaRegistry,
): boolean {
  const parent = findNodeInManifest(root, placement.parentId);
  if (!parent) return false;

  const meta = componentMeta[parent.type];
  if (!meta?.allowedChildren.includes(childType)) return false;

  const children = parent.children ?? [];
  if (placement.referenceId && !children.some((child) => child.id === placement.referenceId)) {
    return false;
  }

  return placement.index >= 0 && placement.index <= children.length;
}

function insertChildAtIndex(args: {
  node: UiNode;
  parentId: string;
  index: number;
  newNode: UiNode;
}): { node: UiNode; inserted: boolean } {
  const { node, parentId, index, newNode } = args;
  if (node.id === parentId) {
    const children = node.children ?? [];
    if (index < 0 || index > children.length) return { node, inserted: false };

    return {
      node: {
        ...node,
        children: [...children.slice(0, index), newNode, ...children.slice(index)],
      },
      inserted: true,
    };
  }

  if (!node.children?.length) return { node, inserted: false };

  const results = node.children.map((child) => insertChildAtIndex({ node: child, parentId, index, newNode }));
  const inserted = results.some((result) => result.inserted);
  return inserted ? { node: { ...node, children: results.map((result) => result.node) }, inserted } : { node, inserted };
}

function isDescendantNode(node: UiNode, descendantId: string): boolean {
  for (const child of node.children ?? []) {
    if (child.id === descendantId || isDescendantNode(child, descendantId)) return true;
  }

  return false;
}

function removeNodeForMove(args: { node: UiNode; nodeId: string }): {
  node: UiNode;
  removedNode: UiNode | null;
} {
  const { node, nodeId } = args;
  const children = node.children ?? [];
  const directIndex = children.findIndex((child) => child.id === nodeId);

  if (directIndex !== -1) {
    const removedNode = children[directIndex];
    if (!removedNode) return { node, removedNode: null };

    return {
      node: {
        ...node,
        children: children.filter((child) => child.id !== nodeId),
      },
      removedNode,
    };
  }

  const nextChildren: UiNode[] = [];
  let removedNode: UiNode | null = null;

  for (const child of children) {
    if (removedNode) {
      nextChildren.push(child);
      continue;
    }

    const result = removeNodeForMove({ node: child, nodeId });
    if (result.removedNode) removedNode = result.removedNode;
    nextChildren.push(result.node);
  }

  if (!removedNode) return { node, removedNode: null };
  return { node: { ...node, children: nextChildren }, removedNode };
}

function adjustMovePlacement(args: { source: NodeWithParent; placement: NodePlacement }): NodePlacement | null {
  const { source, placement } = args;
  if (!source.parent) return null;
  if (placement.referenceId === source.node.id) return null;

  if (placement.parentId !== source.parent.id) return placement;

  const adjustedIndex = source.index < placement.index ? placement.index - 1 : placement.index;
  if (adjustedIndex === source.index) return null;
  return { ...placement, index: adjustedIndex };
}

function normalizeNavigatorAfterRouteUpdate(navigator: NavigatorSpec): NavigatorSpec {
  const nextRoutes = navigator.routes;
  let nextInitialRouteName = navigator.initialRouteName;

  if (nextRoutes.length === 0) {
    nextInitialRouteName = undefined;
  } else if (
    nextInitialRouteName &&
    !nextRoutes.some((route) => route.name === nextInitialRouteName)
  ) {
    nextInitialRouteName = nextRoutes[0]?.name;
  }

  if (nextInitialRouteName === undefined) {
    const { initialRouteName: _omit, ...restNavigator } = navigator;
    return { ...restNavigator, routes: nextRoutes };
  }

  return { ...navigator, routes: nextRoutes, initialRouteName: nextInitialRouteName };
}

function isStyleRecord(value: unknown): value is Record<string, string | number> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;

  return Object.values(value).every(
    (entry) => typeof entry === 'string' || typeof entry === 'number',
  );
}
