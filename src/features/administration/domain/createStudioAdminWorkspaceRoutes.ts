import type { WorkspaceNavigationRoute } from '@ankhorage/navigator/workspace';

import {
  createStudioAdminRoutePath,
  isStudioAdminRouteAvailable,
  STUDIO_ADMIN_ROUTE_REGISTRY,
} from '../../../studioAdminRouteModel';

/*** Project the canonical Studio admin routes into Navigator destinations for the current context. */
export function createStudioAdminWorkspaceRoutes(context: {
  readonly selectedNodeId: string | null;
  readonly screenId: string | null;
  readonly moduleId: string | null;
}): readonly WorkspaceNavigationRoute[] {
  return STUDIO_ADMIN_ROUTE_REGISTRY.map((route) => ({
    id: route.id,
    label: route.label,
    description: route.description,
    parentId: route.parentId,
    visible: route.showInNavigation !== false,
    href: isStudioAdminRouteAvailable(route.id, context)
      ? createStudioAdminRoutePath({ routeId: route.id, ...context })
      : null,
  }));
}
