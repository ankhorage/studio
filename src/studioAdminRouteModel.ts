import type {
  StudioAdminRouteId,
  StudioAdminRoutePath,
  StudioAdminStaticRoutePath,
  StudioPanelId,
} from './index';

export interface StudioAdminRouteDefinition {
  readonly id: StudioAdminRouteId;
  readonly path: StudioAdminStaticRoutePath | '/ankh/properties/:nodeId';
  readonly label: string;
  readonly icon: string;
  readonly order: number;
  readonly parentId?: StudioAdminRouteId;
  readonly description?: string;
  readonly contextual?: boolean;
}

export interface StudioAdminRouteRenderState {
  routeAdminId: StudioAdminRouteId | null;
  resolvedAdminRouteId: StudioAdminRouteId;
  routeAdminPath: StudioAdminRoutePath | null;
  propertiesNodeId: string | null;
  shouldRenderAppContent: boolean;
  shouldRenderAdminShell: boolean;
}

export interface StudioAdminRouteAvailabilityContext {
  readonly selectedNodeId: string | null;
}

export const STUDIO_ADMIN_ROUTE_REGISTRY: readonly StudioAdminRouteDefinition[] = [
  {
    id: 'overview',
    path: '/ankh',
    label: 'Overview',
    icon: 'grid-outline',
    order: 0,
    description: 'Project administration overview and status.',
  },
  {
    id: 'apis',
    path: '/ankh/apis',
    label: 'APIs',
    icon: 'server-outline',
    order: 10,
    description: 'Data sources and runtime operations.',
  },
  {
    id: 'api-data-sources',
    path: '/ankh/apis/data-sources',
    label: 'Data sources',
    icon: 'albums-outline',
    order: 11,
    parentId: 'apis',
    description: 'Configured app data sources.',
  },
  {
    id: 'api-operations',
    path: '/ankh/apis/operations',
    label: 'Operations',
    icon: 'flash-outline',
    order: 12,
    parentId: 'apis',
    description: 'Runtime data-source operations.',
  },
  {
    id: 'auth',
    path: '/ankh/auth',
    label: 'Authentication',
    icon: 'shield-checkmark-outline',
    order: 20,
    description: 'General authentication configuration.',
  },
  {
    id: 'auth-providers',
    path: '/ankh/auth/providers',
    label: 'Providers',
    icon: 'key-outline',
    order: 21,
    parentId: 'auth',
    description: 'OAuth provider activation, credentials, and health.',
  },
  {
    id: 'auth-routes',
    path: '/ankh/auth/routes',
    label: 'Routes',
    icon: 'map-outline',
    order: 22,
    parentId: 'auth',
    description: 'Canonical authentication flow routes.',
  },
  {
    id: 'auth-profile',
    path: '/ankh/auth/profile',
    label: 'Profile',
    icon: 'person-circle-outline',
    order: 23,
    parentId: 'auth',
    description: 'Profile table and field configuration.',
  },
  {
    id: 'secrets',
    path: '/ankh/secrets',
    label: 'Secrets',
    icon: 'lock-closed-outline',
    order: 30,
    description: 'Server-side project secret administration.',
  },
  {
    id: 'theme',
    path: '/ankh/theme',
    label: 'Theme',
    icon: 'color-palette-outline',
    order: 40,
    description: 'Active theme editing.',
  },
  {
    id: 'properties',
    path: '/ankh/properties/:nodeId',
    label: 'Properties',
    icon: 'options-outline',
    order: 50,
    contextual: true,
    description: 'Selected node properties.',
  },
];

const PROPERTIES_ROUTE_PREFIX = '/ankh/properties/';

export function getStudioAdminRouteDefinition(
  routeId: StudioAdminRouteId,
): StudioAdminRouteDefinition {
  const route = STUDIO_ADMIN_ROUTE_REGISTRY.find((candidate) => candidate.id === routeId);
  if (!route) {
    throw new Error(`Unknown Studio admin route id: ${routeId}`);
  }

  return route;
}

export function resolveStudioAdminRouteId(pathname: string): StudioAdminRouteId | null {
  if (pathname.startsWith(PROPERTIES_ROUTE_PREFIX)) {
    return resolveStudioPropertiesNodeId(pathname) ? 'properties' : null;
  }

  const route = STUDIO_ADMIN_ROUTE_REGISTRY.find(
    (candidate) => candidate.path !== '/ankh/properties/:nodeId' && candidate.path === pathname,
  );

  return route?.id ?? null;
}

export function resolveStudioAdminRoutePath(pathname: string): StudioAdminRoutePath | null {
  const routeId = resolveStudioAdminRouteId(pathname);
  if (!routeId) return null;
  if (routeId === 'properties') {
    const nodeId = resolveStudioPropertiesNodeId(pathname);
    return nodeId ? createStudioPropertiesRoutePath(nodeId) : null;
  }

  return getStudioAdminRouteDefinition(routeId).path;
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

export function createStudioPropertiesRoutePath(nodeId: string): `/ankh/properties/${string}` {
  return `/ankh/properties/${encodeURIComponent(nodeId)}`;
}

export function createStudioAdminRoutePath(args: {
  routeId: StudioAdminRouteId;
  selectedNodeId?: string | null;
}): StudioAdminRoutePath | null {
  if (args.routeId === 'properties') {
    return args.selectedNodeId ? createStudioPropertiesRoutePath(args.selectedNodeId) : null;
  }

  return getStudioAdminRouteDefinition(args.routeId).path;
}

export function isStudioAdminRouteAvailable(
  routeId: StudioAdminRouteId,
  context: StudioAdminRouteAvailabilityContext,
): boolean {
  if (routeId === 'properties') {
    return context.selectedNodeId !== null;
  }

  return true;
}

export function resolveStudioAdminActiveRouteId(pathname: string): StudioAdminRouteId {
  return resolveStudioAdminRouteId(pathname) ?? 'overview';
}

export function isStudioAdminRouteActive(args: {
  currentRouteId: StudioAdminRouteId;
  candidateRouteId: StudioAdminRouteId;
}): boolean {
  if (args.currentRouteId === args.candidateRouteId) {
    return true;
  }

  let route = getStudioAdminRouteDefinition(args.currentRouteId);
  while (route.parentId) {
    if (route.parentId === args.candidateRouteId) return true;
    route = getStudioAdminRouteDefinition(route.parentId);
  }

  return false;
}

export function createStudioAdminRouteRenderState(args: {
  pathname: string;
  activeAdminRouteId: StudioAdminRouteId;
}): StudioAdminRouteRenderState {
  const routeAdminId = resolveStudioAdminRouteId(args.pathname);
  const resolvedAdminRouteId = routeAdminId ?? args.activeAdminRouteId;
  const routeAdminPath = resolveStudioAdminRoutePath(args.pathname);

  return {
    routeAdminId,
    resolvedAdminRouteId,
    routeAdminPath,
    propertiesNodeId: resolveStudioPropertiesNodeId(args.pathname),
    shouldRenderAppContent: routeAdminId === null,
    shouldRenderAdminShell: routeAdminId !== null,
  };
}

export function openStudioAdminRoute(args: {
  next: StudioAdminRouteId;
  selectedNodeId?: string | null;
  setActivePanelId: (panelId: StudioPanelId | null) => void;
  pushRoute: (routePath: StudioAdminRoutePath) => void;
}): boolean {
  const routePath = createStudioAdminRoutePath({
    routeId: args.next,
    selectedNodeId: args.selectedNodeId ?? null,
  });
  if (!routePath) return false;

  args.setActivePanelId(null);
  args.pushRoute(routePath);
  return true;
}

export function isStudioAdminPath(pathname: string): boolean {
  return pathname === '/ankh' || pathname.startsWith('/ankh/');
}

export function resolveStudioNavigableLocation(pathname: string): string {
  const runtimeGlobal = globalThis as { readonly location?: Location };
  const { location } = runtimeGlobal;
  if (location?.pathname === pathname) {
    return `${pathname}${location.search}${location.hash}`;
  }

  return pathname;
}
