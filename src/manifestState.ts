import type {
  AppManifest,
  AuthOAuthProviderConfig,
  ComponentDataBindingRegistry,
  DataSourceRegistry,
  NavigatorSpec,
  NavigatorType,
  RouteDefinition,
  ScreenSpec,
  ThemeConfig,
  UiNode,
} from '@ankhorage/contracts';
import { NAVIGATOR_TYPES } from '@ankhorage/contracts';

import type {
  NodePlacement,
  StudioComponentMetaRegistry,
  StudioIdGenerator,
  StudioManifest,
  StudioMode,
  ThemeUpdates,
} from './index';
import { insertNodeAtPlacement, moveNodeToPlacement } from './index';

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

export type StudioScreenNavigationDiagnosticCode =
  | 'ambiguous-route-target'
  | 'ambiguous-screen-route-reference'
  | 'duplicate-sibling-route-name'
  | 'empty-navigator'
  | 'invalid-initial-route'
  | 'missing-route-target'
  | 'missing-screen-reference';

export interface StudioScreenNavigationDiagnostic {
  code: StudioScreenNavigationDiagnosticCode;
  message: string;
  parentPath: string[];
  routeName?: string;
  screenId?: string;
}

export interface StudioScreenRouteReference {
  route: RouteDefinition;
  parentPath: string[];
  routePath: string[];
  pathnamePattern: string;
  siblingIndex: number;
  navigatorType: NavigatorType;
  isPrimaryNavigatorMember: boolean;
  showInPrimaryNavigation: boolean;
  isPrimaryInitialRoute: boolean;
}

export interface StudioScreenNavigationEntry {
  screenId: string;
  screen: ScreenSpec;
  routeReferences: StudioScreenRouteReference[];
}

export interface StudioScreenNavigationModel {
  primaryNavigatorPath: string[];
  primaryNavigator: NavigatorSpec;
  screens: StudioScreenNavigationEntry[];
  diagnostics: StudioScreenNavigationDiagnostic[];
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
    generatedApis: Object.keys(manifest.generatedApis ?? {}),
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

/**
 * Derives the complete package-neutral screen/navigation authoring model from
 * the manifest without flattening its navigator tree.
 */
export function deriveStudioScreenNavigationModel(
  manifest: StudioManifest,
): StudioScreenNavigationModel {
  const primaryNavigatorPath = getPrimaryNavigatorPath(manifest.navigator.routes);
  const primaryNavigator =
    findNavigatorAtPath(manifest.navigator, primaryNavigatorPath) ?? manifest.navigator;
  const diagnostics: StudioScreenNavigationDiagnostic[] = [];
  const referencesByScreenId = new Map<string, StudioScreenRouteReference[]>();

  collectNavigationModelReferences({
    navigator: manifest.navigator,
    screens: manifest.screens,
    primaryNavigatorPath,
    parentPath: [],
    routePathPrefix: [],
    runtimePathPrefix: [],
    diagnostics,
    referencesByScreenId,
  });

  const screens = Object.entries(manifest.screens).map(([screenId, screen]) => {
    const routeReferences = referencesByScreenId.get(screenId) ?? [];
    if (routeReferences.length > 1) {
      diagnostics.push({
        code: 'ambiguous-screen-route-reference',
        message: `Screen "${screenId}" is referenced by ${routeReferences.length} routes.`,
        parentPath: [],
        screenId,
      });
    }

    return { screenId, screen, routeReferences };
  });

  return {
    primaryNavigatorPath,
    primaryNavigator,
    screens,
    diagnostics,
  };
}

/**
 * Returns a concrete canonical app pathname only when a screen has one route
 * reference and that route does not require runtime parameters.
 */
export function resolveStudioScreenAppPath(
  model: StudioScreenNavigationModel,
  screenId: string,
): string | null {
  const entry = model.screens.find((candidate) => candidate.screenId === screenId);
  if (!entry) return null;
  if (entry.routeReferences.length !== 1) return null;
  const [reference] = entry.routeReferences;
  if (!reference) return null;

  const hasDynamicSegment = reference.pathnamePattern
    .split('/')
    .some((segment) => segment.startsWith(':') || /^\[.*\]$/u.test(segment));
  if (hasDynamicSegment) return null;

  const matchingReferences = model.screens.flatMap((candidate) =>
    candidate.routeReferences.filter(
      (candidateReference) => candidateReference.pathnamePattern === reference.pathnamePattern,
    ),
  );
  return matchingReferences.length === 1 ? reference.pathnamePattern : null;
}

function collectNavigationModelReferences(args: {
  navigator: NavigatorSpec;
  screens: StudioManifest['screens'];
  primaryNavigatorPath: string[];
  parentPath: string[];
  routePathPrefix: string[];
  runtimePathPrefix: string[];
  diagnostics: StudioScreenNavigationDiagnostic[];
  referencesByScreenId: Map<string, StudioScreenRouteReference[]>;
}): void {
  const {
    navigator,
    screens,
    primaryNavigatorPath,
    parentPath,
    routePathPrefix,
    runtimePathPrefix,
    diagnostics,
    referencesByScreenId,
  } = args;
  const siblingNameCounts = new Map<string, number>();
  for (const route of navigator.routes) {
    siblingNameCounts.set(route.name, (siblingNameCounts.get(route.name) ?? 0) + 1);
  }

  if (navigator.routes.length === 0) {
    diagnostics.push({
      code: 'empty-navigator',
      message: `Navigator at "${formatParentPath(parentPath)}" has no routes.`,
      parentPath,
    });
  }

  if (
    navigator.initialRouteName !== undefined &&
    siblingNameCounts.get(navigator.initialRouteName) !== 1
  ) {
    diagnostics.push({
      code: 'invalid-initial-route',
      message: `Initial route "${navigator.initialRouteName}" is not one unambiguous direct route of "${formatParentPath(parentPath)}".`,
      parentPath,
      routeName: navigator.initialRouteName,
    });
  }

  for (const [siblingIndex, route] of navigator.routes.entries()) {
    const routePath = [...routePathPrefix, route.name];
    const runtimePath = appendRuntimeRoutePath(runtimePathPrefix, route);
    const isPrimaryNavigatorMember = pathsEqual(parentPath, primaryNavigatorPath);

    if (
      (siblingNameCounts.get(route.name) ?? 0) > 1 &&
      navigator.routes.findIndex((candidate) => candidate.name === route.name) === siblingIndex
    ) {
      diagnostics.push({
        code: 'duplicate-sibling-route-name',
        message: `Route name "${route.name}" is duplicated under "${formatParentPath(parentPath)}".`,
        parentPath,
        routeName: route.name,
        screenId: route.screenId,
      });
    }

    if (!route.screenId && !route.navigator) {
      diagnostics.push({
        code: 'missing-route-target',
        message: `Route "${route.name}" has neither a screen nor a nested navigator.`,
        parentPath,
        routeName: route.name,
      });
    } else if (route.screenId && route.navigator) {
      diagnostics.push({
        code: 'ambiguous-route-target',
        message: `Route "${route.name}" targets both a screen and a nested navigator.`,
        parentPath,
        routeName: route.name,
        screenId: route.screenId,
      });
    }

    if (route.screenId) {
      if (!screens[route.screenId]) {
        diagnostics.push({
          code: 'missing-screen-reference',
          message: `Route "${route.name}" references missing screen "${route.screenId}".`,
          parentPath,
          routeName: route.name,
          screenId: route.screenId,
        });
      } else {
        const reference: StudioScreenRouteReference = {
          route,
          parentPath,
          routePath,
          pathnamePattern: toCanonicalRoutePattern(runtimePath),
          siblingIndex,
          navigatorType: navigator.type,
          isPrimaryNavigatorMember,
          showInPrimaryNavigation: route.showInPrimaryNavigation !== false,
          isPrimaryInitialRoute:
            isPrimaryNavigatorMember && navigator.initialRouteName === route.name,
        };
        const currentReferences = referencesByScreenId.get(route.screenId) ?? [];
        currentReferences.push(reference);
        referencesByScreenId.set(route.screenId, currentReferences);
      }
    }

    if (route.navigator) {
      collectNavigationModelReferences({
        navigator: route.navigator,
        screens,
        primaryNavigatorPath,
        parentPath: routePath,
        routePathPrefix: routePath,
        runtimePathPrefix: runtimePath,
        diagnostics,
        referencesByScreenId,
      });
    }
  }
}

function appendRuntimeRoutePath(runtimePathPrefix: string[], route: RouteDefinition): string[] {
  const explicitPath = route.path?.trim();
  const segmentPath = explicitPath ?? route.name;
  const segments = segmentPath.split('/').filter(Boolean);
  return explicitPath?.startsWith('/') ? segments : [...runtimePathPrefix, ...segments];
}

function pathsEqual(first: readonly string[], second: readonly string[]): boolean {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}

function formatParentPath(parentPath: readonly string[]): string {
  return parentPath.length === 0 ? '<root>' : parentPath.join('/');
}

export function listScreenIdsInRouteOrder(routes: RouteDefinition[]): string[] {
  return collectScreenRouteEntries(routes).map((entry) => entry.screenId);
}

/**
 * Resolves the initial leaf screen selected by a nested navigator tree.
 * Each navigator's initial route is preferred, with unusable routes falling
 * back to the first route that reaches an available screen.
 */
export function resolveInitialScreenId(
  navigator: NavigatorSpec,
  screens?: AppManifest['screens'],
): string | null {
  const initialRoute = navigator.initialRouteName
    ? navigator.routes.find((route) => route.name === navigator.initialRouteName)
    : undefined;
  const candidateRoutes = initialRoute
    ? [initialRoute, ...navigator.routes.filter((route) => route !== initialRoute)]
    : navigator.routes;

  for (const route of candidateRoutes) {
    if (route.navigator) {
      const nestedScreenId = resolveInitialScreenId(route.navigator, screens);
      if (nestedScreenId) return nestedScreenId;
    }

    if (route.screenId && (!screens || screens[route.screenId])) {
      return route.screenId;
    }
  }

  return null;
}

export function resolveInitialActiveScreenId(manifest: StudioManifest | null): string | null {
  if (!manifest) return null;

  const firstRoutedScreenId = resolveInitialScreenId(manifest.navigator, manifest.screens);
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

export function findScreenIdForNode(manifest: StudioManifest, nodeId: string): string | null {
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

  const deletedNode = findNodeInManifest(screen.root, nodeId);
  if (!deletedNode) return manifest;

  const newRoot = removeNodeFromManifestTree(screen.root, nodeId);
  if (!newRoot || newRoot === screen.root) return manifest;

  const deletedNodeIds = collectNodeIds(deletedNode);

  const nextDataBindings = Object.fromEntries(
    Object.entries(manifest.dataBindings ?? {}).filter(
      ([componentId, binding]) =>
        !deletedNodeIds.has(componentId) && !deletedNodeIds.has(binding.componentId),
    ),
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
  const insertion = insertNodeAtPlacement({
    root: screen.root,
    placement,
    componentMeta,
    makeNode: () => newNode,
  });
  if (!insertion) return null;

  return {
    manifest: {
      ...manifest,
      screens: {
        ...manifest.screens,
        [activeScreenId]: {
          ...screen,
          root: insertion.root,
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

  const movement = moveNodeToPlacement({
    root: screen.root,
    nodeId,
    placement,
    componentMeta,
  });
  if (!movement) return null;

  return {
    manifest: {
      ...manifest,
      screens: {
        ...manifest.screens,
        [activeScreenId]: {
          ...screen,
          root: movement.root,
        },
      },
    },
    movedNodeId: movement.movedNodeId,
  };
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
    manifest.activeThemeId === themeId
      ? (themes[0]?.id ?? manifest.activeThemeId)
      : manifest.activeThemeId;

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
      const nested = findParentPathForScreenId(
        route.navigator.routes,
        screenId,
        routePath,
        routePath,
      );
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
  const matches = routes.filter((item) => item.name === segment);
  if (matches.length !== 1) return null;
  const [route] = matches;
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
  const matches = routes.filter((route) => route.name === segment && route.navigator);
  if (matches.length !== 1) return routes;
  const [targetRoute] = matches;
  return routes.map((route) => {
    if (route !== targetRoute || !route.navigator?.routes) return route;

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
  const matches = navigator.routes.filter((item) => item.name === segment);
  if (matches.length !== 1) return null;
  const [route] = matches;
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
  const matches = navigator.routes.filter((route) => route.name === segment && route.navigator);
  if (matches.length !== 1) return navigator;
  const [targetRoute] = matches;
  return {
    ...navigator,
    routes: navigator.routes.map((route) => {
      if (route !== targetRoute || !route.navigator) return route;

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
  if (!NAVIGATOR_TYPES.includes(type)) return manifest;
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
  if (currentNavigator.routes.filter((route) => route.name === normalizedRoute).length !== 1) {
    return manifest;
  }
  if (currentNavigator.initialRouteName === normalizedRoute) return manifest;

  return {
    ...manifest,
    navigator: updateNavigatorAtPath(manifest.navigator, primaryNavigatorPath, (current) => ({
      ...current,
      initialRouteName: normalizedRoute,
    })),
  };
}

export function setStudioManifestRoutePrimaryNavigationVisibility(args: {
  manifest: StudioManifest;
  parentPath: string[];
  routeName: string;
  showInPrimaryNavigation: boolean;
}): StudioManifest {
  const { manifest, parentPath, routeName, showInPrimaryNavigation } = args;
  const navigator = findNavigatorAtPath(manifest.navigator, parentPath);
  if (!navigator) return manifest;
  const matches = navigator.routes.filter((route) => route.name === routeName);
  if (matches.length !== 1) return manifest;
  const [matchedRoute] = matches;
  if (!matchedRoute) return manifest;

  const alreadyCanonical = showInPrimaryNavigation
    ? matchedRoute.showInPrimaryNavigation === undefined
    : matchedRoute.showInPrimaryNavigation === false;
  if (alreadyCanonical) return manifest;

  return {
    ...manifest,
    navigator: updateNavigatorAtPath(manifest.navigator, parentPath, (current) => ({
      ...current,
      routes: current.routes.map((route) => {
        if (route !== matchedRoute) return route;
        if (!showInPrimaryNavigation) {
          return { ...route, showInPrimaryNavigation: false };
        }
        const { showInPrimaryNavigation: _visibility, ...visibleRoute } = route;
        return visibleRoute;
      }),
    })),
  };
}

export function moveStudioManifestRoute(args: {
  manifest: StudioManifest;
  parentPath: string[];
  routeName: string;
  toIndex: number;
}): StudioManifest {
  const { manifest, parentPath, routeName, toIndex } = args;
  if (!Number.isInteger(toIndex)) return manifest;
  const navigator = findNavigatorAtPath(manifest.navigator, parentPath);
  if (!navigator || toIndex < 0 || toIndex >= navigator.routes.length) return manifest;
  const matchingIndexes = navigator.routes.flatMap((route, index) =>
    route.name === routeName ? [index] : [],
  );
  if (matchingIndexes.length !== 1) return manifest;
  const [fromIndex] = matchingIndexes;
  if (fromIndex === undefined || fromIndex === toIndex) return manifest;

  return {
    ...manifest,
    navigator: updateNavigatorAtPath(manifest.navigator, parentPath, (current) => {
      const routes = [...current.routes];
      const [route] = routes.splice(fromIndex, 1);
      if (!route) return current;
      routes.splice(toIndex, 0, route);
      return { ...current, routes };
    }),
  };
}

export function addStudioManifestScreen(args: {
  manifest: StudioManifest;
  name: string;
  activeScreenId: string | null;
  parentPath?: string[];
  createId?: StudioIdGenerator;
  screenTemplate?: UiNode;
}): StudioManifestScreenMutationResult {
  const { manifest, activeScreenId, createId = generateManifestStateId } = args;
  const trimmedName = args.name.trim();
  if (!trimmedName) return { manifest, activeScreenId };

  const baseRouteName = normalizeRouteName(trimmedName);
  const parentPath = args.parentPath ?? getPrimaryNavigatorPath(manifest.navigator.routes);
  const siblingRoutes = findRoutesAtParentPath(manifest.navigator.routes, parentPath);
  if (!siblingRoutes) return { manifest, activeScreenId };

  let screenId = createId('Screen');
  while (manifest.screens[screenId]) {
    screenId = createId('Screen');
  }

  const existingPatterns = new Set(collectCanonicalRoutePatterns(manifest.navigator.routes));
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
  const deletedScreen = manifest.screens[screenId];
  if (!deletedScreen) return { manifest, activeScreenId };

  const { [screenId]: _deletedScreen, ...remainingScreens } = manifest.screens;
  const remainingScreenIds = Object.keys(remainingScreens);
  const safeRoutes = removeScreenIdFromRoutes(manifest.navigator.routes, screenId);

  const orderedScreenIds = listScreenIdsInRouteOrder(safeRoutes).filter(
    (id) => !!remainingScreens[id],
  );
  const nextActiveScreenId =
    !activeScreenId || activeScreenId === screenId || !remainingScreens[activeScreenId]
      ? (orderedScreenIds[0] ?? remainingScreenIds[0] ?? null)
      : activeScreenId;
  const deletedNodeIds = collectNodeIds(deletedScreen.root);
  const dataBindings = Object.fromEntries(
    Object.entries(manifest.dataBindings ?? {}).filter(
      ([componentId, binding]) =>
        !deletedNodeIds.has(componentId) && !deletedNodeIds.has(binding.componentId),
    ),
  );

  return {
    activeScreenId: nextActiveScreenId,
    manifest: {
      ...manifest,
      dataBindings,
      screens: remainingScreens,
      navigator: normalizeNavigatorAfterRouteUpdate({
        ...manifest.navigator,
        routes: safeRoutes,
      }),
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

function collectCanonicalRoutePatterns(
  routes: RouteDefinition[],
  runtimePathPrefix: string[] = [],
): string[] {
  const patterns: string[] = [];
  for (const route of routes) {
    const runtimePath = appendRuntimeRoutePath(runtimePathPrefix, route);
    patterns.push(toCanonicalRoutePattern(runtimePath));
    if (route.navigator) {
      patterns.push(...collectCanonicalRoutePatterns(route.navigator.routes, runtimePath));
    }
  }
  return patterns;
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

  const nextChildren = root.children.map(
    (child) => removeNodeFromManifestTree(child, nodeId) ?? child,
  );
  const hasChanged = nextChildren.some((child, index) => child !== root.children?.[index]);
  return hasChanged ? { ...root, children: nextChildren } : root;
}

function collectNodeIds(root: UiNode): Set<string> {
  const ids = new Set<string>();
  const visit = (node: UiNode): void => {
    ids.add(node.id);
    for (const child of node.children ?? []) visit(child);
  };
  visit(root);
  return ids;
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
