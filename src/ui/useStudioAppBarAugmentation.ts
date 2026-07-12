import { IconButton } from '@ankhorage/zora';
import { usePathname, useRouter } from 'expo-router';
import React, { useCallback } from 'react';

import { useStudio } from '../core/StudioContext';
import { resolveStudioAdminRoutePath } from '../studioAdminRouteModel';
import { StudioAdminOverlay } from './StudioAdminOverlay';
import { StudioAuthSettingsOverlay } from './StudioAuthSettingsOverlay';

export interface StudioAppBarAugmentation {
  appMode?: unknown;
  actions?: React.ReactNode;
  overflow?: unknown;
  overlay?: React.ReactNode;
}

export function useStudioAppBarAugmentation(): StudioAppBarAugmentation {
  const studio = useStudio();
  const pathname = usePathname();
  const router = useRouter();
  const activeRoute = resolveStudioAdminRoutePath(pathname);

  const openRoute = useCallback(
    (route: '/ankh/auth' | '/ankh/secrets') => {
      studio.setActivePanelId(null);
      router.push(route);
    },
    [router, studio],
  );

  const closeOverlay = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/');
  }, [router]);

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

  const overlay =
    activeRoute === '/ankh/auth'
      ? React.createElement(StudioAuthSettingsOverlay, {
          projectId: studio.projectId,
          manifest: studio.manifest,
          onClose: closeOverlay,
        })
      : activeRoute === '/ankh/secrets'
        ? React.createElement(StudioAdminOverlay, {
            projectId: studio.projectId,
            onClose: closeOverlay,
          })
        : null;

  return {
    actions,
    overlay,
  } satisfies StudioAppBarAugmentation;
}
