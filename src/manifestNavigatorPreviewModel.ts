import type { AppManifest, IconSpec, NavigatorSpec, RouteDefinition } from '@ankhorage/contracts';

import {
  collectScreenRouteEntries,
  findNavigatorAtPath,
  getPrimaryNavigatorPath,
} from './routeUtils';

export interface PreviewNavigationDiagnostic {
  kind: 'icon';
  severity: 'warning';
  message: string;
  routeName: string;
  provider?: string;
  iconName?: string;
}

export interface PreviewNavigationRoute {
  name: string;
  label: string;
  icon?: IconSpec;
  route: RouteDefinition;
}

export interface StudioNavigationRouteMapEntry {
  label: string;
  icon?: IconSpec;
}

export type StudioNavigationRouteMap = Record<string, StudioNavigationRouteMapEntry>;

export interface ManifestNavigatorPreviewModel {
  navigator: NavigatorSpec;
  visibleRoutes: readonly PreviewNavigationRoute[];
  routeMap: StudioNavigationRouteMap;
  activeRouteIndex: number;
  activeRouteName: string | null;
  resolvedActiveScreenId: string | null;
  iconDiagnostics: readonly PreviewNavigationDiagnostic[];
}

function normalizeAuthFlowPathToRouteName(routePath: string): string {
  const normalized = routePath.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  return normalized === '' ? 'index' : normalized;
}

function collectAuthFlowRouteNames(manifest: AppManifest): Set<string> {
  const flow = manifest.settings.authFlow;
  const routeNames = new Set<string>();

  const candidates: (string | undefined)[] = [
    flow.signInRoute,
    flow.signUpRoute,
    flow.signOutRoute,
    flow.forgotPasswordRoute,
    flow.otpRoute,
    flow.unauthorizedRoute,
  ];

  for (const routePath of candidates) {
    if (typeof routePath !== 'string') continue;
    const trimmed = routePath.trim();
    if (!trimmed) continue;
    routeNames.add(normalizeAuthFlowPathToRouteName(trimmed));
  }

  return routeNames;
}

function resolveRouteLabelString(route: RouteDefinition, manifest: AppManifest): string {
  const screen = route.screenId ? manifest.screens[route.screenId] : undefined;
  return route.label ?? screen?.title ?? screen?.name ?? route.name;
}

function resolvePrimaryNavigator(manifest: AppManifest): NavigatorSpec {
  const primaryNavigatorPath = getPrimaryNavigatorPath(manifest.navigator.routes);
  return findNavigatorAtPath(manifest.navigator, primaryNavigatorPath) ?? manifest.navigator;
}

function resolveVisibleChromeRoutes(args: {
  manifest: AppManifest;
  navigator: NavigatorSpec;
}): PreviewNavigationRoute[] {
  const { manifest, navigator } = args;
  const authRouteNames = collectAuthFlowRouteNames(manifest);

  return navigator.routes
    .filter((route) => route.hideInTabBar !== true)
    .filter((route) => !authRouteNames.has(route.name))
    .map((route) => ({
      name: route.name,
      label: resolveRouteLabelString(route, manifest),
      icon: route.icon,
      route,
    }));
}

function resolveInitialVisibleRouteName(args: {
  navigator: NavigatorSpec;
  visibleRoutes: readonly PreviewNavigationRoute[];
}): string | null {
  const { navigator, visibleRoutes } = args;
  const visibleNames = new Set(visibleRoutes.map((r) => r.name));

  if (navigator.initialRouteName && visibleNames.has(navigator.initialRouteName)) {
    return navigator.initialRouteName;
  }

  const [first] = visibleRoutes;
  return first ? first.name : null;
}

function resolveActiveChromeRouteName(args: {
  navigator: NavigatorSpec;
  visibleRoutes: readonly PreviewNavigationRoute[];
  activeScreenId?: string | undefined;
}): string | null {
  const { navigator, visibleRoutes, activeScreenId } = args;

  if (activeScreenId) {
    const entries = collectScreenRouteEntries(navigator.routes);
    const entry = entries.find((candidate) => candidate.screenId === activeScreenId);
    const routeName = entry?.routePath[0] ?? null;
    if (routeName && visibleRoutes.some((route) => route.name === routeName)) {
      return routeName;
    }
  }

  return resolveInitialVisibleRouteName({ navigator, visibleRoutes });
}

export function resolveLeafScreenIdForRoute(route: RouteDefinition): string | null {
  if (route.screenId) return route.screenId;

  const nested = route.navigator;
  if (!nested || nested.routes.length === 0) return null;

  const candidate =
    (nested.initialRouteName
      ? nested.routes.find((r) => r.name === nested.initialRouteName)
      : null) ?? nested.routes[0];
  if (!candidate) return null;
  return resolveLeafScreenIdForRoute(candidate);
}

export function resolveLeafScreenIdForChromeRouteName(args: {
  navigator: NavigatorSpec;
  visibleRoutes: readonly PreviewNavigationRoute[];
  routeName: string;
}): string | null {
  const { visibleRoutes, routeName } = args;
  const route = visibleRoutes.find((item) => item.name === routeName)?.route;
  if (!route) return null;
  return resolveLeafScreenIdForRoute(route);
}

const EXPO_VECTOR_ICON_PROVIDER_ALIASES: Record<string, string> = {
  'material-community': 'MaterialCommunityIcons',
};

const KNOWN_EXPO_VECTOR_ICON_PROVIDERS = new Set<string>([
  'AntDesign',
  'Entypo',
  'EvilIcons',
  'Feather',
  'FontAwesome',
  'FontAwesome5',
  'FontAwesome6',
  'Fontisto',
  'Foundation',
  'Ionicons',
  'MaterialCommunityIcons',
  'MaterialIcons',
  'Octicons',
  'SimpleLineIcons',
  'Zocial',
]);

function normalizeExpoIconProvider(provider: string): string {
  const trimmed = provider.trim();
  const normalizedKey = trimmed.toLowerCase();
  return EXPO_VECTOR_ICON_PROVIDER_ALIASES[normalizedKey] ?? trimmed;
}

function resolvePreviewIconDiagnostics(
  routes: readonly PreviewNavigationRoute[],
): PreviewNavigationDiagnostic[] {
  const diagnostics: PreviewNavigationDiagnostic[] = [];

  for (const route of routes) {
    const { icon } = route;
    if (!icon) continue;

    if (typeof icon.provider !== 'string' || icon.provider.trim().length === 0) {
      continue;
    }

    const provider = normalizeExpoIconProvider(icon.provider);
    if (!KNOWN_EXPO_VECTOR_ICON_PROVIDERS.has(provider)) {
      diagnostics.push({
        kind: 'icon',
        severity: 'warning',
        message: `Unknown icon provider "${provider}" for route "${route.name}".`,
        routeName: route.name,
        provider,
        iconName: icon.name,
      });
      continue;
    }
  }

  return diagnostics;
}

function buildStudioRouteMap(args: {
  manifest: AppManifest;
  visibleRoutes: readonly PreviewNavigationRoute[];
}): StudioNavigationRouteMap {
  const { manifest, visibleRoutes } = args;
  const routeMap: StudioNavigationRouteMap = {};

  for (const item of visibleRoutes) {
    const { route } = item;
    const label = resolveRouteLabelString(route, manifest);
    const icon = route.icon
      ? {
          name: route.icon.name,
          ...(route.icon.provider ? { provider: route.icon.provider } : {}),
        }
      : undefined;

    routeMap[item.name] = {
      label,
      ...(icon ? { icon } : {}),
    };
  }

  return routeMap;
}

export function buildManifestNavigatorPreviewModel(args: {
  manifest: AppManifest;
  activeScreenId?: string | undefined;
}): ManifestNavigatorPreviewModel {
  const { manifest, activeScreenId } = args;
  const navigator = resolvePrimaryNavigator(manifest);
  const visibleRoutes = resolveVisibleChromeRoutes({ manifest, navigator });
  const activeRouteName = resolveActiveChromeRouteName({
    navigator,
    visibleRoutes,
    activeScreenId,
  });

  const activeRouteIndex =
    activeRouteName && visibleRoutes.length > 0
      ? Math.max(
          0,
          visibleRoutes.findIndex((route) => route.name === activeRouteName),
        )
      : 0;

  const clampedIndex =
    visibleRoutes.length === 0 ? 0 : Math.min(activeRouteIndex, visibleRoutes.length - 1);
  const normalizedActiveRouteName = visibleRoutes[clampedIndex]?.name ?? null;
  const resolvedActiveScreenId = normalizedActiveRouteName
    ? resolveLeafScreenIdForChromeRouteName({
        navigator,
        visibleRoutes,
        routeName: normalizedActiveRouteName,
      })
    : null;

  const routeMap = buildStudioRouteMap({ manifest, visibleRoutes });
  const iconDiagnostics = resolvePreviewIconDiagnostics(visibleRoutes);

  return {
    navigator,
    visibleRoutes,
    routeMap,
    activeRouteIndex: clampedIndex,
    activeRouteName: normalizedActiveRouteName,
    resolvedActiveScreenId,
    iconDiagnostics,
  };
}
