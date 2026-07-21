import { IconButton } from '@ankhorage/zora';
import { usePathname, useRouter } from 'expo-router';
import React, { useCallback } from 'react';

import { useStudio } from '../core/StudioContext';
import {
  createStudioPropertiesRoutePath,
  isStudioAdminPath,
  resolveStudioLastNonAdminLocation,
  resolveStudioNavigableLocation,
} from '../studioAdminRouteModel';
import { createStudioSelectionContext } from '../studioSelectionModel';
import { resolveStudioAppBarContextActions } from './studioAppBarModel';

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
    const appLocation = resolveStudioLastNonAdminLocation({
      pathname,
      navigableLocation: resolveStudioNavigableLocation(pathname),
    });
    if (appLocation) {
      studio.setLastNonAdminLocation(appLocation);
    }
    studio.setActivePanelId(null);
    router.push('/ankh');
  }, [pathname, router, studio]);

  const selection = createStudioSelectionContext({
    rootNode: studio.rootNode,
    selectedNodeId: studio.selectedNodeId,
  });

  const openProperties = useCallback(() => {
    if (!selection.selectedNodeId) return;
    router.push(createStudioPropertiesRoutePath(selection.selectedNodeId));
  }, [router, selection.selectedNodeId]);

  const clearSelection = useCallback(() => {
    studio.selectNode(null);
  }, [studio]);

  const selectParent = useCallback(() => {
    if (!selection.parentNodeId) return;
    studio.selectNode(selection.parentNodeId);
  }, [selection.parentNodeId, studio]);

  const contextActions = resolveStudioAppBarContextActions({
    selectedNodeId: selection.selectedNodeId,
    parentNodeId: selection.parentNodeId,
  });

  const actions = isStudioAdminPath(pathname)
    ? null
    : React.createElement(
        React.Fragment,
        null,
        React.createElement(IconButton, {
          icon: { name: 'settings-outline' },
          label: 'Administration',
          variant: 'ghost',
          color: 'neutral',
          onPress: openAdministration,
        }),
        selection.selectedNodeId
          ? React.createElement(
              React.Fragment,
              null,
              ...contextActions.map((action) => {
                const handler =
                  action.id === 'properties'
                    ? openProperties
                    : action.id === 'selectParent'
                      ? selectParent
                      : clearSelection;
                return React.createElement(IconButton, {
                  key: action.id,
                  icon:
                    action.id === 'properties'
                      ? { name: 'options-outline' }
                      : action.id === 'selectParent'
                        ? { name: 'arrow-up-outline' }
                        : { name: 'close-outline' },
                  label: action.label,
                  variant: 'ghost',
                  color: 'neutral',
                  onPress: handler,
                });
              }),
            )
          : null,
      );

  return {
    actions,
  } satisfies StudioAppBarAugmentation;
}
