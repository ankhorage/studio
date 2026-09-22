import type { WorkspaceNavigatorProps } from '@ankhorage/navigator/workspace';
import { usePathname } from 'expo-router';

import { useStudio } from '../../../../core/StudioContext';
import {
  resolveStudioAdminActiveRouteId,
  resolveStudioModuleId,
  resolveStudioScreenId,
  STUDIO_ADMIN_ROUTE_REGISTRY,
} from '../../../../studioAdminRouteModel';
import { createStudioAdminWorkspaceRoutes } from '../../domain/createStudioAdminWorkspaceRoutes';

/*** Bind Studio-owned authoring context and route semantics to Navigator's workspace runtime. */
export function useStudioAdminWorkspace(): WorkspaceNavigatorProps {
  const studio = useStudio();
  const pathname = usePathname();
  const routes = createStudioAdminWorkspaceRoutes({
    selectedNodeId: studio.selectedNodeId,
    screenId: resolveStudioScreenId(pathname) ?? studio.activeScreenId,
    moduleId: resolveStudioModuleId(pathname),
  });
  return {
    routes,
    activeRouteId: resolveStudioAdminActiveRouteId(pathname),
    title: 'Administration',
    exit: { label: 'Back to app', href: studio.lastNonAdminLocation || '/' },
    onNavigate: (routeId) => {
      const route = STUDIO_ADMIN_ROUTE_REGISTRY.find((candidate) => candidate.id === routeId);
      if (route) studio.setActiveAdminRouteId(route.id);
    },
  };
}
