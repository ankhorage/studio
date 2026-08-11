import type {
  StudioAdminRouteId,
  StudioAdminRoutePath,
  StudioAdminStaticRoutePath,
  StudioPanelId,
} from './index';

export interface StudioAdminRouteDefinition {
  readonly id: StudioAdminRouteId;
  readonly path:
    | StudioAdminStaticRoutePath
    | '/ankh/screens/:screenId'
    | '/ankh/bindings/:nodeId'
    | '/ankh/properties/:nodeId';
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
  screenId: string | null;
  bindingsNodeId: string | null;
  propertiesNodeId: string | null;
  shouldRenderAppContent: boolean;
  shouldRenderAdminShell: boolean;
}

export interface StudioAdminRouteAvailabilityContext {
  readonly selectedNodeId: string | null;
  readonly screenId?: string | null;
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
    id: 'screens',
    path: '/ankh/screens',
    label: 'Screens',
    icon: 'phone-portrait-outline',
    order: 10,
    description: 'Screens and primary app navigation.',
  },
  {
    id: 'screen-detail',
    path: '/ankh/screens/:screenId',
    label: 'Screen detail',
    icon: 'document-text-outline',
    order: 11,
    parentId: 'screens',
    contextual: true,
    description: 'Canonical screen metadata and resolved route context.',
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
    id: 'bindings',
    path: '/ankh/bindings/:nodeId',
    label: 'Bindings',
    icon: 'git-branch-outline',
    order: 50,
    contextual: true,
    description: 'Selected node property/data and event/action bindings.',
  },
  {
    id: 'properties',
    path: '/ankh/properties/:nodeId',
    label: 'Properties',
    icon: 'options-outline',
    order: 51,
    contextual: true,
    description: 'Selected node properties.',
  },
];

const BINDINGS_ROUTE_PREFIX = '/ankh/bindings/';
const PROPERTIES_ROUTE_PREFIX = '/ankh/properties/';
const SCREEN_ROUTE_PREFIX = '/ankh/screens/';

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
  if (pathname.startsWith(SCREEN_ROUTE_PREFIX)) {
    return resolveStudioScreenId(pathname) ? 'screen-detail' : null;
  }

  if (pathname.startsWith(BINDINGS_ROUTE_PREFIX)) {
    return resolveStudioBindingsNodeId(pathname) ? 'bindings' : null;
  }

  if (pathname.startsWith(PROPERTIES_ROUTE_PREFIX)) {
    return resolveStudioPropertiesNodeId(pathname) ? 'properties' : null;
  }

  const route = STUDIO_ADMIN_ROUTE_REGISTRY.find(
    (candidate) =>
      candidate.path !== '/ankh/bindings/:nodeId' &&
      candidate.path !== '/ankh/properties/:nodeId' &&
      candidate.path !== '/ankh/screens/:screenId' &&
      candidate.path === pathname,
  );

  return route?.id ?? null;
}

export function resolveStudioAdminRoutePath(pathname: string): StudioAdminRoutePath | null {
  const routeId = resolveStudioAdminRouteId(pathname);
  if (!routeId) return null;
  if (routeId === 'screen-detail') {
    const screenId = resolveStudioScreenId(pathname);
    return screenId ? createStudioScreenRoutePath(screenId) : null;
  }
  if (routeId === 'bindings') {
    const nodeId = resolveStudioBindingsNodeId(pathname);
    return nodeId ? createStudioBindingsRoutePath(nodeId) : null;
  }
  if (routeId === 'properties') {
    const nodeId = resolveStudioPropertiesNodeId(pathname);
    return nodeId ? createStudioPropertiesRoutePath(nodeId) : null;
  }

  return getStudioAdminRouteDefinition(routeId).path;
}

export function resolveStudioBindingsNodeId(pathname: string): string | null {
  return resolveStudioContextNodeId(pathname, BINDINGS_ROUTE_PREFIX);
}

export function resolveStudioScreenId(pathname: string): string | null {
  return resolveStudioDetailId(pathname, SCREEN_ROUTE_PREFIX);
}

export function createStudioScreenRoutePath(screenId: string): `/ankh/screens/${string}` {
  return `/ankh/screens/${encodeURIComponent(screenId)}`;
}

export function createStudioBindingsRoutePath(nodeId: string): `/ankh/bindings/${string}` {
  return `/ankh/bindings/${encodeURIComponent(nodeId)}`;
}

export function resolveStudioPropertiesNodeId(pathname: string): string | null {
  return resolveStudioContextNodeId(pathname, PROPERTIES_ROUTE_PREFIX);
}

export function createStudioPropertiesRoutePath(nodeId: string): `/ankh/properties/${string}` {
  return `/ankh/properties/${encodeURIComponent(nodeId)}`;
}

export function createStudioAdminRoutePath(args: {
  routeId: StudioAdminRouteId;
  selectedNodeId?: string | null;
  screenId?: string | null;
}): StudioAdminRoutePath | null {
  if (args.routeId === 'screen-detail') {
    return args.screenId ? createStudioScreenRoutePath(args.screenId) : null;
  }
  if (args.routeId === 'bindings') {
    return args.selectedNodeId ? createStudioBindingsRoutePath(args.selectedNodeId) : null;
  }
  if (args.routeId === 'properties') {
    return args.selectedNodeId ? createStudioPropertiesRoutePath(args.selectedNodeId) : null;
  }

  return getStudioAdminRouteDefinition(args.routeId).path;
}

export function isStudioAdminRouteAvailable(
  routeId: StudioAdminRouteId,
  context: StudioAdminRouteAvailabilityContext,
): boolean {
  if (routeId === 'bindings' || routeId === 'properties') {
    return context.selectedNodeId !== null;
  }
  if (routeId === 'screen-detail') {
    return Boolean(context.screenId);
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
    screenId: resolveStudioScreenId(args.pathname),
    bindingsNodeId: resolveStudioBindingsNodeId(args.pathname),
    propertiesNodeId: resolveStudioPropertiesNodeId(args.pathname),
    shouldRenderAppContent: routeAdminId === null,
    shouldRenderAdminShell: routeAdminId !== null,
  };
}

export function openStudioAdminRoute(args: {
  next: StudioAdminRouteId;
  selectedNodeId?: string | null;
  screenId?: string | null;
  setActivePanelId: (panelId: StudioPanelId | null) => void;
  pushRoute: (routePath: StudioAdminRoutePath) => void;
}): boolean {
  const routePath = createStudioAdminRoutePath({
    routeId: args.next,
    selectedNodeId: args.selectedNodeId ?? null,
    screenId: args.screenId ?? null,
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

export function resolveStudioLastNonAdminLocation(args: {
  readonly pathname: string;
  readonly navigableLocation?: string;
}): string | null {
  if (isStudioAdminPath(args.pathname)) return null;
  return args.navigableLocation ?? resolveStudioNavigableLocation(args.pathname);
}

function resolveStudioContextNodeId(pathname: string, prefix: string): string | null {
  if (!pathname.startsWith(prefix)) return null;
  const [encodedNodeId] = pathname.slice(prefix.length).split('/');
  if (!encodedNodeId) return null;
  try {
    return decodeURIComponent(encodedNodeId);
  } catch {
    return encodedNodeId;
  }
}

function resolveStudioDetailId(pathname: string, prefix: string): string | null {
  if (!pathname.startsWith(prefix)) return null;
  const remainder = pathname.slice(prefix.length);
  if (!remainder || remainder.includes('/')) return null;
  try {
    return decodeURIComponent(remainder) || null;
  } catch {
    return null;
  }
}
