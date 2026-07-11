import { IconButton } from '@ankhorage/zora';
import React, { useCallback, useState } from 'react';

import { useStudio } from '../core/StudioContext';
import {
  StudioAdminOverlay,
  type StudioPhase2AdminRoute,
} from './StudioAdminOverlay';

export interface StudioAppBarAugmentation {
  appMode?: unknown;
  actions?: React.ReactNode;
  overflow?: unknown;
  overlay?: React.ReactNode;
}

export function useStudioAppBarAugmentation(): StudioAppBarAugmentation {
  const studio = useStudio();
  const [activeRoute, setActiveRoute] = useState<StudioPhase2AdminRoute | null>(null);

  const openRoute = useCallback((route: StudioPhase2AdminRoute) => {
    studio.setActivePanelId(null);
    setActiveRoute(route);
  }, [studio]);

  const closeOverlay = useCallback(() => {
    setActiveRoute(null);
  }, []);

  const actions = React.createElement(
    React.Fragment,
    null,
    React.createElement(IconButton, {
      icon: { name: 'shield-checkmark-outline' },
      label: 'Authentication settings',
      variant: 'ghost',
      color: activeRoute === '/ankh/auth' ? 'primary' : 'neutral',
      onPress: () => openRoute('/ankh/auth'),
    }),
    React.createElement(IconButton, {
      icon: { name: 'key-outline' },
      label: 'Project secrets',
      variant: 'ghost',
      color: activeRoute === '/ankh/secrets' ? 'primary' : 'neutral',
      onPress: () => openRoute('/ankh/secrets'),
    }),
  );

  const overlay = activeRoute
    ? React.createElement(StudioAdminOverlay, {
        route: activeRoute,
        projectId: studio.projectId,
        manifest: studio.manifest,
        onClose: closeOverlay,
      })
    : null;

  return {
    actions,
    overlay,
  } satisfies StudioAppBarAugmentation;
}
