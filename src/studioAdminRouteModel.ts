import type { StudioAdminRoutePath, StudioPanelId } from './index';

export type StudioResolvedAdminRoutePath = StudioAdminRoutePath | '/ankh/secrets';

export interface StudioAdminRouteRenderState {
  routeAdminPath: StudioResolvedAdminRoutePath | null;
  resolvedAdminRoutePath: StudioResolvedAdminRoutePath;
  propertiesNodeId: string | null;
  shouldRenderAppContent: true;
  shouldRenderAdminOverlay: boolean;
}

const ADMIN_ROUTE_PATHS = ['/ankh/apis', '/ankh/auth', '/ankh/secrets', '/ankh/theme'] as const;
const PROPERTIES_ROUTE_PREFIX = '/ankh/properties/';

export function resolveStudioAdminRoutePath(pathname: string): StudioResolvedAdminRoutePath | null {
  if (pathname.startsWith(PROPERTIES_ROUTE_PREFIX)) {
    return '/ankh/properties';
  }

  return ADMIN_ROUTE_PATHS.find((routePath) => routePath === pathname) ?? null;
}

export function resolveStudioPropertiesNodeId(pathname: string): string | null {
  if (!pathname.startsWith(PROPERTIES_ROUTE_PREFIX)) {
    return null;
  }

  const [encodedNodeId] = pathname.slice(PROPERTIES_ROUTE_PREFIX.length).split('/');
  if (!encodedNodeId) {
    return null;
  }

  try {
    return decodeURIComponent(encodedNodeId);
  } catch {
    return encodedNodeId;
  }
}

export function createStudioAdminRouteRenderState(args: {
  pathname: string;
  activeAdminRoutePath: StudioAdminRoutePath;
}): StudioAdminRouteRenderState {
  const routeAdminPath = resolveStudioAdminRoutePath(args.pathname);
  const resolvedAdminRoutePath = routeAdminPath ?? args.activeAdminRoutePath;

  return {
    routeAdminPath,
    resolvedAdminRoutePath,
    propertiesNodeId: resolveStudioPropertiesNodeId(args.pathname),
    shouldRenderAppContent: true,
    shouldRenderAdminOverlay: resolvedAdminRoutePath !== '/',
  };
}

export function openStudioAdminRoute(args: {
  next: Exclude<StudioResolvedAdminRoutePath, '/'>;
  setActivePanelId: (panelId: StudioPanelId | null) => void;
  pushRoute: (routePath: Exclude<StudioResolvedAdminRoutePath, '/'>) => void;
}): void {
  args.setActivePanelId(null);
  args.pushRoute(args.next);
}

export function createStudioPropertiesRoutePath(nodeId: string): `/ankh/properties/${string}` {
  return `/ankh/properties/${encodeURIComponent(nodeId)}`;
}
