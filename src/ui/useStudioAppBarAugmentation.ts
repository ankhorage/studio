import { IconButton } from '@ankhorage/zora';
import { usePathname, useRouter } from 'expo-router';
import React, { useCallback } from 'react';

import { useStudio } from '../core/StudioContext';
import { isStudioAdminPath } from '../studioAdminRouteModel';

export interface StudioAppBarAugmentation {
  appMode?: unknown;
  actions?: React.ReactNode;
  overflow?: unknown;
}

export function useStudioAppBarAugmentation(): StudioAppBarAugmentation {
  const studio = useStudio();
  const pathname = usePathname();
  const router = useRouter();

  const openAdministration = useCallback(() => {
    if (!isStudioAdminPath(pathname)) {
      studio.setLastNonAdminLocation(pathname);
    }

    studio.setActivePanelId(null);
    router.push('/ankh');
  }, [pathname, router, studio]);

  const actions = isStudioAdminPath(pathname)
    ? null
    : React.createElement(IconButton, {
        icon: { name: 'settings-outline' },
        label: 'Administration',
        variant: 'ghost',
        color: 'neutral',
        onPress: openAdministration,
      });

  return {
    actions,
  } satisfies StudioAppBarAugmentation;
}
