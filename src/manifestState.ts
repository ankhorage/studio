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
  | 'duplicate-screen-id'
  | 'duplicate-sibling-route-name'
  | 'empty-navigator'
  | 'invalid-initial-route'
  | 'missing-route-target'
  | 'missing-screen-reference'
  | 'screen-registry-key-mismatch';

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

/***
 * Generate a Studio manifest-state identifier from the current time, randomness, and optional prefix.
 * @todo Move this identifier policy from the src root into the manifest domain or the domain that owns generated authoring IDs.
 */
export const generateManifestStateId: StudioIdGenerator = (prefix?: string): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 11);
  const id = `${timestamp}-${random}`;
  return prefix ? `${prefix.toLowerCase()}-${id}` : id;
};

/***
 * Serialize the manifest fields used to detect broad Studio authoring-state changes.
 * @todo Move this manifest state projection from the src root into the manifest domain.
 */
export function createStudioManifestFingerprint(manifest: StudioManifest | null): string {
  if (!manifest) return '';

  return JSON.stringify({
    navigator: manifest.navigator,
    screens: Object.keys(manifest.screens),
    dataBindings: Object.keys(manifest.dataBindings ?? {}),
    dataSources: Object.keys(manifest.dataSources ?? {}),
    themes: manifest.themes.map((theme) => theme.id),
    activeThemeId: manifest.activeThemeId,
    activeThemeMode: manifest.activeThemeMode,
    settings: manifest.settings,
    infra: manifest.infra,
  });
}

/***
 * Convert a navigator parent path to the stable key used for route grouping.
 * @todo Move this route-path helper from the src root into routes/.
 */
export function pathToKey(path: string[]): string {
  return path.length === 0 ? '__root__' : path.join('/');
}

/***
 * Return whether a route segment represents an Expo Router-style group segment.
 * @todo Move this route semantic helper from the src root into routes/.
 */
export function isRouteGroupSegment(segment: string): boolean {
  return /^\(.*\)$/.test(segment);
}

/***
 * Recursively collect screen-targeting routes together with their navigator and route paths.
 * @todo Move route traversal from the src root into routes/.
 */
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

/***
 * Group collected screen routes by the navigator parent path that owns them.
 * @todo Move route grouping from the src root into routes/.
 */
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

/***
 * Verify that every screen registry key equals its unique stable ScreenSpec identifier.
 * @todo Move this manifest screen invariant from the src root into the manifest domain.
 */
export function hasCanonicalStudioScreenRegistryIdentity(
  screens: StudioManifest['screens'],
): boolean {
  const screenIds = new Set<string>();
  for (const [registryKey, screen] of Object.entries(screens)) {
    if (registryKey !== screen.id || screenIds.has(screen.id)) return false;
    screenIds.add(screen.id);
  }
  return true;
}

/***
 * Resolve a screen by stable identifier only when the manifest screen registry satisfies its canonical identity invariant.
 * @todo Move this screen lookup from the src root into the manifest domain.
 */
function resolveCanonicalStudioScreen(
  manifest: StudioManifest,
  screenId: string,
): ScreenSpec | undefined {
  if (!hasCanonicalStudioScreenRegistryIdentity(manifest.screens)) return undefined;
  return Object.values(manifest.screens).find((screen) => screen.id === screenId);
}

/***
 * Derive the complete screen/navigation authoring model and diagnostics without flattening the navigator tree.
 * @todo Move navigation-model derivation from the src root into routes/.
 */
export function deriveStudioScreenNavigationModel(
  manifest: StudioManifest,
): StudioScreenNavigationModel {
  const primaryNavigatorPath = getPrimaryNavigatorPath(manifest.navigator.routes);
  const primaryNavigator =
    findNavigatorAtPath(manifest.navigator, primaryNavigatorPath) ?? manifest.navigator;
  const diagnostics: StudioScreenNavigationDiagnostic[] = [];
  const referencesByRegistryKey = new Map<string, StudioScreenRouteReference[]>();

  collectNavigationModelReferences({
    navigator: manifest.navigator,
    screens: manifest.screens,
    primaryNavigatorPath,
    parentPath: [],
    routePathPrefix: [],
    runtimePathPrefix: [],
    diagnostics,
    referencesByRegistryKey,
  });

  const screenIdCounts = new Map<string, number>();
  for (const screen of Object.values(manifest.screens)) {
    screenIdCounts.set(screen.id, (screenIdCounts.get(screen.id) ?? 0) + 1);
  }
  const reportedDuplicateScreenIds = new Set<string>();

  const screens = Object.entries(manifest.screens).map(([registryKey, screen]) => {
    const screenId = screen.id;
    const routeReferences = referencesByRegistryKey.get(registryKey) ?? [];
    if (registryKey !== screenId) {
      diagnostics.push({
        code: 'screen-registry-key-mismatch',
        message: `Screen registry key "${registryKey}" does not match stable ScreenSpec.id "${screenId}".`,
        parentPath: [],
        screenId,
      });
    }
    if ((screenIdCounts.get(screenId) ?? 0) > 1 && !reportedDuplicateScreenIds.has(screenId)) {
      reportedDuplicateScreenIds.add(screenId);
      diagnostics.push({
        code: 'duplicate-screen-id',
        message: `Stable ScreenSpec.id "${screenId}" is used by multiple screen registry entries.`,
        parentPath: [],
        screenId,
      });
    }
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

/***
 * Resolve a concrete app pathname only when a screen has one unique, non-dynamic route reference.
 * @todo Move canonical route-path resolution from the src root into routes/.
 */
export function resolveStudioScreenAppPath(
  model: StudioScreenNavigationModel,
  screenId: string,
): string | null {
  const matchingEntries = model.screens.filter((candidate) => candidate.screenId === screenId);
  if (matchingEntries.length !== 1) return null;
  const [entry] = matchingEntries;
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

/***
 * Traverse a navigator tree to collect route references and navigation diagnostics for each screen.
 * @todo Move navigation traversal and diagnostics from the src root into routes/.
 */
function collectNavigationModelReferences(args: {
  navigator: NavigatorSpec;
  screens: StudioManifest['screens'];
  primaryNavigatorPath: string[];
  parentPath: string[];
  routePathPrefix: string[];
  runtimePathPrefix: string[];
  diagnostics: StudioScreenNavigationDiagnostic[];
  referencesByRegistryKey: Map<string, StudioScreenRouteReference[]>;
}): void {
  const {
    navigator,
    screens,
    primaryNavigatorPath,
    parentPath,
    routePathPrefix,
    runtimePathPrefix,
    diagnostics,
    referencesByRegistryKey,
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
        const currentReferences = referencesByRegistryKey.get(route.screenId) ?? [];
        currentReferences.push(reference);
        referencesByRegistryKey.set(route.screenId, currentReferences);
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
        referencesByRegistryKey,
      });
    }
  }
}

/***
 * Append one route's explicit or named path segments to the current runtime route path.
 * @todo Move runtime route-path construction from the src root into routes/.
 */
function appendRuntimeRoutePath(runtimePathPrefix: string[], route: RouteDefinition): string[] {
  const explicitPath = route.path?.trim();
  const segmentPath = explicitPath ?? route.name;
  const segments = segmentPath.split('/').filter(Boolean);
  return explicitPath?.startsWith('/') ? segments : [...runtimePathPrefix, ...segments];
}

/***
 * Compare two route paths for ordered segment equality.
 * @todo Keep this small comparison helper local to routes/ unless broader reuse is demonstrated.
 */
function pathsEqual(first: readonly string[], second: readonly string[]): boolean {
  return (
    first.length === second.length && first.every((value, index) => value === second.at(index))
  );
}

/***
 * Format a route parent path for navigation diagnostic messages.
 * @todo Move route diagnostic formatting from the src root into routes/.
 */
function formatParentPath(parentPath: readonly string[]): string {
  return parentPath.length === 0 ? '<root>' : parentPath.join('/');
}

/***
 * List routed screen identifiers in navigator traversal order.
 * @todo Move route ordering behavior from the src root into routes/.
 */
export function listScreenIdsInRouteOrder(routes: RouteDefinition[]): string[] {
  return collectScreenRouteEntries(routes).map((entry) => entry.screenId);
}

/***
 * Resolve the initial leaf screen selected by a nested navigator tree, falling back to the first usable route.
 * @todo Move initial-route resolution from the src root into routes/.
 */
export function resolveInitialScreenId(
  navigator: NavigatorSpec,
  screens?: AppManifest['screens'],
): string | null {
  if (screens && !hasCanonicalStudioScreenRegistryIdentity(screens)) return null;
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
      return screens ? (screens[route.screenId]?.id ?? null) : route.screenId;
    }
  }

  return null;
}

/***
 * Resolve the active screen Studio should select when a manifest is first opened.
 * @todo Move initial Studio screen selection out of the src root into routes/ or selection/ according to its caller boundary.
 */
export function resolveInitialActiveScreenId(manifest: StudioManifest | null): string | null {
  if (!manifest || !hasCanonicalStudioScreenRegistryIdentity(manifest.screens)) return null;

  const firstRoutedScreenId = resolveInitialScreenId(manifest.navigator, manifest.screens);
  const [firstScreenId] = Object.values(manifest.screens).map((screen) => screen.id);
  return firstRoutedScreenId ?? firstScreenId ?? null;
}

/***
 * Resolve the root UI node for the active canonical screen.
 * @todo Move active-screen root resolution from the src root into the manifest/selection boundary.
 */
export function resolveActiveRootNode(
  manifest: StudioManifest | null,
  activeScreenId: string | null,
): UiNode | null {
  if (!manifest || !activeScreenId) return null;
  return resolveCanonicalStudioScreen(manifest, activeScreenId)?.root ?? null;
}

/***
 * Recursively find a UI node by identifier in a manifest-owned UI tree.
 * @todo Move UI-tree traversal from the src root into canvas/.
 */
export function findNodeInManifest(root: UiNode, id: string): UiNode | null {
  if (root.id === id) return root;

  for (const child of root.children ?? []) {
    const nested = findNodeInManifest(child, id);
    if (nested) return nested;
  }

  return null;
}

/***
 * Keep a selected node identifier only while that node still exists in the active tree.
 * @todo Move selection validity policy from the src root into selection/.
 */
export function resolveSafeSelectedNodeId(
  rootNode: UiNode | null,
  selectedNodeId: string | null,
): string | null {
  if (!selectedNodeId || !rootNode) return null;
  return findNodeInManifest(rootNode, selectedNodeId) ? selectedNodeId : null;
}

/***
 * Find the canonical screen whose UI tree contains a given node identifier.
 * @todo Move screen ownership lookup from the src root into the manifest/canvas boundary.
 */
export function findScreenIdForNode(manifest: StudioManifest, nodeId: string): string | null {
  if (!hasCanonicalStudioScreenRegistryIdentity(manifest.screens)) return null;
  for (const screen of Object.values(manifest.screens)) {
    if (findNodeInManifest(screen.root, nodeId)) {
      return screen.id;
    }
  }

  return null;
}

/***
 * Update authored properties of one node in the active screen while preserving manifest immutability.
 * @todo Move canvas node mutation from the src root into canvas/.
 */
export function updateStudioManifestNode(
  manifest: StudioManifest,
  activeScreenId: string | null,
  nodeId: string,
  newProps: Record<string, unknown>,
): StudioManifest {
  if (!activeScreenId) return manifest;
  const screen = resolveCanonicalStudioScreen(manifest, activeScreenId);
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

/***
 * Delete a non-root node from the active screen and remove data bindings owned by the deleted subtree.
 * @todo Split this canvas mutation and binding cleanup between canvas/ and bindings/ instead of the src root.
 */
export function deleteStudioManifestNode(
  manifest: StudioManifest,
  activeScreenId: string | null,
  nodeId: string,
): StudioManifest {
  if (!activeScreenId) return manifest;
  const screen = resolveCanonicalStudioScreen(manifest, activeScreenId);
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

/***
 * Insert a new UI node at a validated canvas placement in the active screen.
 * @todo Move canvas insertion orchestration from the src root into canvas/.
 */
export function insertStudioManifestNodeAtPlacement(args: {
  manifest: StudioManifest;
  activeScreenId: string | null;
  placement: NodePlacement;
  newNode: UiNode;
  componentMeta: StudioComponentMetaRegistry;
}): StudioManifestNodeInsertResult | null {
  const { manifest, activeScreenId, placement, newNode, componentMeta } = args;
  if (!activeScreenId) return null;
  const screen = resolveCanonicalStudioScreen(manifest, activeScreenId);
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

/***
 * Move an existing UI node to a validated canvas placement in the active screen.
 * @todo Move canvas movement orchestration from the src root into canvas/.
 */
export function moveStudioManifestNodeToPlacement(args: {
  manifest: StudioManifest;
  activeScreenId: string | null;
  nodeId: string;
  placement: NodePlacement;
  componentMeta: StudioComponentMetaRegistry;
}): StudioManifestNodeMoveResult | null {
  const { manifest, activeScreenId, nodeId, placement, componentMeta } = args;
  if (!activeScreenId) return null;
  const screen = resolveCanonicalStudioScreen(manifest, activeScreenId);
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

/***
 * Replace the manifest component data-binding registry.
 * @todo Move binding-state mutation from the src root into bindings/.
 */
export function updateStudioManifestDataBindings(
  manifest: StudioManifest,
  dataBindings: ComponentDataBindingRegistry,
): StudioManifest {
  return { ...manifest, dataBindings };
}

/***
 * Replace the manifest data-source registry.
 * @todo Resolve data-source authoring ownership with bindings/external APIs and remove this src-root mutation.
 */
export function updateStudioManifestDataSources(
  manifest: StudioManifest,
  dataSources: DataSourceRegistry,
): StudioManifest {
  return { ...manifest, dataSources };
}

/***
 * Create the default light/dark theme configuration for a newly authored theme.
 * @todo Extract theme authoring from manifestState.ts; the current Studio structure target does not yet name a dedicated theme domain.
 */
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

/***
 * Append a theme to the manifest, creating a default theme when none is supplied.
 * @todo Extract theme authoring from manifestState.ts into its resolved owner.
 */
export function addStudioManifestTheme(
  manifest: StudioManifest,
  theme = createDefaultThemeConfig(manifest.themes.length),
): StudioManifest {
  return { ...manifest, themes: [...manifest.themes, theme] };
}

/***
 * Merge shared and mode-specific updates into one manifest theme.
 * @todo Extract theme authoring from manifestState.ts into its resolved owner.
 */
export function updateStudioManifestTheme(
  manifest: StudioManifest,
  themeId: string,
  updates: ThemeUpdates,
): StudioManifest {
  return {
    ...manifest,
    themes: manifest.themes.map((theme) => {
      if (theme.id !== themeId) return theme;

      const { light, dark, ...sharedUpdates } = updates;
      return {
        ...theme,
        ...sharedUpdates,
        ...(light ? { light: { ...theme.light, ...light } } : {}),
        ...(dark ? { dark: { ...theme.dark, ...dark } } : {}),
      };
    }),
  };
}

/***
 * Delete a theme while preserving at least one theme and a valid active-theme identifier.
 * @todo Extract theme authoring from manifestState.ts into its resolved owner.
 */
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

/***
 * Set the active theme identifier in the manifest.
 * @todo Extract theme authoring from manifestState.ts into its resolved owner.
 */
export function setStudioManifestActiveThemeId(
  manifest: StudioManifest,
  activeThemeId: string,
): StudioManifest {
  return { ...manifest, activeThemeId };
}

/***
 * Set the active light/dark theme mode in the manifest.
 * @todo Extract theme authoring from manifestState.ts into its resolved owner.
 */
export function setStudioManifestActiveThemeMode(
  manifest: StudioManifest,
  activeThemeMode: NonNullable<StudioManifest['activeThemeMode']>,
): StudioManifest {
  return { ...manifest, activeThemeMode };
}

/***
 * Replace OAuth providers while preserving or creating the surrounding manifest auth configuration.
 * @todo Move auth policy from the src root into auth/.
 */
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

/***
 * Resolve the navigator path Studio treats as the primary application navigator.
 * @todo Move primary-navigator policy from the src root into routes/.
 */
export function getPrimaryNavigatorPath(routes: RouteDefinition[]): string[] {
  const appGroupRoute = routes.find((route) => route.name === '(app)' && route.navigator?.routes);
  if (appGroupRoute) return ['(app)'];

  const appRoute = routes.find((route) => route.name === 'app' && route.navigator?.routes);
  if (appRoute) return ['app'];

  return [];
}

/***
 * Find the navigator parent path that owns a route targeting the requested screen.
 * @todo Move route traversal from the src root into routes/.
 */
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

/***
 * Resolve the direct route collection owned by a navigator parent path.
 * @todo Move navigator path lookup from the src root into routes/.
 */
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

/***
 * Insert a route into the navigator identified by a parent path without mutating the existing tree.
 * @todo Move route-tree mutation from the src root into routes/.
 */
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

/***
 * Resolve a nested navigator by its route-name path.
 * @todo Move navigator lookup from the src root into routes/.
 */
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

/***
 * Immutably update the navigator identified by a route-name path.
 * @todo Move navigator-tree mutation from the src root into routes/.
 */
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

/***
 * Change the primary navigator type when the requested navigator type is valid and different.
 * @todo Move navigator authoring policy from the src root into routes/.
 */
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

/***
 * Change the primary navigator initial route when the requested sibling route is unique.
 * @todo Move navigator authoring policy from the src root into routes/.
 */
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

/***
 * Set whether one route is visible in primary navigation while preserving the canonical visible representation.
 * @todo Move route visibility authoring from the src root into routes/.
 */
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

/***
 * Reorder one uniquely named route within its navigator parent.
 * @todo Move route ordering authoring from the src root into routes/.
 */
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

/***
 * Create a new screen from a template, generate a collision-free route, and make the new screen active.
 * @todo Split screen creation between manifest screen state and routes/ instead of keeping both in one src-root function.
 */
export function addStudioManifestScreen(args: {
  manifest: StudioManifest;
  name: string;
  activeScreenId: string | null;
  parentPath?: string[];
  createId?: StudioIdGenerator;
  screenTemplate?: UiNode;
}): StudioManifestScreenMutationResult {
  const { manifest, activeScreenId, createId = generateManifestStateId } = args;
  if (!hasCanonicalStudioScreenRegistryIdentity(manifest.screens)) {
    return { manifest, activeScreenId };
  }
  const trimmedName = args.name.trim();
  if (!trimmedName) return { manifest, activeScreenId };

  const baseRouteName = normalizeRouteName(trimmedName);
  const parentPath = args.parentPath ?? getPrimaryNavigatorPath(manifest.navigator.routes);
  const siblingRoutes = findRoutesAtParentPath(manifest.navigator.routes, parentPath);
  if (!siblingRoutes) return { manifest, activeScreenId };

  const existingScreenIds = new Set(Object.values(manifest.screens).map((screen) => screen.id));
  let screenId = createId('Screen');
  while (Object.hasOwn(manifest.screens, screenId) || existingScreenIds.has(screenId)) {
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

/***
 * Delete a screen, remove route references and bindings for its subtree, and resolve a safe next active screen.
 * @todo Split this cross-domain operation across manifest, routes/, bindings/, and selection application responsibilities.
 */
export function deleteStudioManifestScreen(
  manifest: StudioManifest,
  screenId: string,
  activeScreenId: string | null,
): StudioManifestScreenMutationResult {
  if (!hasCanonicalStudioScreenRegistryIdentity(manifest.screens)) {
    return { manifest, activeScreenId };
  }
  if (Object.keys(manifest.screens).length <= 1) return { manifest, activeScreenId };
  const deletedScreen = resolveCanonicalStudioScreen(manifest, screenId);
  if (!deletedScreen) return { manifest, activeScreenId };

  const remainingScreens = Object.fromEntries(
    Object.entries(manifest.screens).filter(([registryKey]) => registryKey !== screenId),
  );
  const remainingScreenIds = Object.keys(remainingScreens);
  const safeRoutes = removeScreenIdFromRoutes(manifest.navigator.routes, screenId);

  const orderedScreenIds = listScreenIdsInRouteOrder(safeRoutes).filter((id) =>
    Object.hasOwn(remainingScreens, id),
  );
  const nextActiveScreenId =
    !activeScreenId ||
    activeScreenId === screenId ||
    !Object.hasOwn(remainingScreens, activeScreenId)
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

/***
 * Recursively remove a screen target from routes and prune nested navigators that become empty.
 * @todo Move route cleanup from the src root into routes/.
 */
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

/***
 * Generate a route name that is unique among sibling routes by appending a numeric suffix when needed.
 * @todo Move route-name generation from the src root into routes/.
 */
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

/***
 * Convert route path segments to the canonical pathname pattern used by Studio authoring.
 * @todo Move canonical route-pattern logic from the src root into routes/.
 */
export function toCanonicalRoutePattern(routePath: string[]): string {
  const normalized = routePath.filter((segment) => !isRouteGroupSegment(segment));
  while (normalized[0] === 'index') normalized.shift();
  while (normalized.at(-1) === 'index') normalized.pop();
  return normalized.length ? `/${normalized.join('/')}` : '/';
}

/***
 * Generate a route name that avoids both sibling-name and canonical-path collisions.
 * @todo Move route-name collision policy from the src root into routes/.
 */
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

/***
 * Normalize arbitrary screen text into the lowercase hyphenated route-name form used by Studio.
 * @todo Keep this semantic route-name normalization under routes/ rather than extracting it as a generic slug utility.
 */
function normalizeRouteName(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'screen'
  );
}

/***
 * Collect canonical pathname patterns for every route in a nested navigator tree.
 * @todo Move route-pattern traversal from the src root into routes/.
 */
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

/***
 * Deep-clone a UI node tree while assigning fresh identifiers and copying mutable node data.
 * @todo Move UI-tree cloning from the src root into canvas/.
 */
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

/***
 * Immutably update alias, style, and props for a node in a UI tree.
 * @todo Move UI-tree mutation from the src root into canvas/ or properties/ according to final authoring ownership.
 */
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
  const hasChanged = nextChildren.some((child, index) => child !== root.children?.at(index));
  return hasChanged ? { ...root, children: nextChildren } : root;
}

/***
 * Immutably remove a node from a UI tree while preserving the remaining hierarchy.
 * @todo Move UI-tree mutation from the src root into canvas/.
 */
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
  const hasChanged = nextChildren.some((child, index) => child !== root.children?.at(index));
  return hasChanged ? { ...root, children: nextChildren } : root;
}

/***
 * Collect every node identifier in a UI subtree.
 * @todo Move UI-tree traversal from the src root into canvas/.
 */
function collectNodeIds(root: UiNode): Set<string> {
  const ids = new Set<string>();
  const visit = (node: UiNode): void => {
    ids.add(node.id);
    for (const child of node.children ?? []) visit(child);
  };
  visit(root);
  return ids;
}

/***
 * Repair a navigator's initial-route field after route removal while preserving canonical omission when no initial route exists.
 * @todo Move navigator normalization from the src root into routes/.
 */
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

/***
 * Narrow an unknown node style value to the string-or-number style record accepted by Studio node updates.
 * @todo Keep this semantic style predicate with the canvas/properties authoring logic rather than treating it as a generic record utility.
 */
function isStyleRecord(value: unknown): value is Record<string, string | number> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;

  return Object.values(value).every(
    (entry) => typeof entry === 'string' || typeof entry === 'number',
  );
}
