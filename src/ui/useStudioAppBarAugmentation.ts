import { IconButton } from '@ankhorage/zora';
import { usePathname, useRouter } from 'expo-router';
import React, { useCallback } from 'react';

import { useStudio } from '../core/StudioContext';
import {
  buildInsertCatalogEntries,
  findNodeById,
  resolveInsertCatalogEntries,
  type StudioNodeId,
} from '../index';
import { resolveNodeLabel } from '../insertModalModel';
import {
  createStudioBindingsRoutePath,
  createStudioPropertiesRoutePath,
  isStudioAdminPath,
  resolveStudioLastNonAdminLocation,
  resolveStudioNavigableLocation,
} from '../studioAdminRouteModel';
import { createStudioSelectionContext } from '../studioSelectionModel';
import {
  resolveStudioAppBarContextActions,
  resolveStudioAppBarModeAction,
} from './studioAppBarModel';
import { StudioDeleteDialog } from './StudioDeleteDialog';
import { StudioInsertDialog } from './StudioInsertDialog';

export interface StudioAppBarAugmentation {
  appMode?: unknown;
  actions?: React.ReactNode;
  overflow?: unknown;
  overlays?: React.ReactNode;
}

function resolveContextActionIcon(id: string): { name: string } {
  if (id === 'properties') return { name: 'options-outline' };
  if (id === 'bindings') return { name: 'git-branch-outline' };
  if (id === 'insert') return { name: 'add-outline' };
  if (id === 'delete') return { name: 'trash-outline' };
  if (id === 'selectParent') return { name: 'arrow-up-outline' };
  return { name: 'close-outline' };
}

export function useStudioAppBarAugmentation(): StudioAppBarAugmentation {
  const studio = useStudio();
  const pathname = usePathname();
  const router = useRouter();
  const [insertVisible, setInsertVisible] = React.useState(false);
  const [deleteCandidateId, setDeleteCandidateId] = React.useState<StudioNodeId | null>(null);
  const isAdminPath = isStudioAdminPath(pathname);

  React.useEffect(() => {
    if (!studio.previewMode) return;
    setInsertVisible(false);
    setDeleteCandidateId(null);
    studio.setActivePanelId(null);
  }, [studio.previewMode, studio.setActivePanelId]);

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

  const openBindings = useCallback(() => {
    if (!selection.selectedNodeId) return;
    router.push(createStudioBindingsRoutePath(selection.selectedNodeId));
  }, [router, selection.selectedNodeId]);

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

  const catalogEntries = React.useMemo(
    () => buildInsertCatalogEntries({ componentMeta: studio.componentMeta }),
    [studio.componentMeta],
  );
  const resolvedInsertEntries = React.useMemo(
    () =>
      resolveInsertCatalogEntries({
        entries: catalogEntries,
        root: studio.rootNode,
        selectedNodeId: selection.selectedNodeId,
        componentMeta: studio.componentMeta,
      }),
    [catalogEntries, selection.selectedNodeId, studio.componentMeta, studio.rootNode],
  );
  const enabledEntries = resolvedInsertEntries.filter((entry) => entry.status === 'enabled');
  const canInsert = enabledEntries.length > 0;
  const canInsertInside = enabledEntries.some(
    (entry) =>
      entry.placement?.kind === 'inside' && entry.placement.parentId === selection.selectedNodeId,
  );
  const canDelete = selection.selectedNodeId !== null && selection.parentNodeId !== null;

  const selectedNode =
    studio.rootNode && selection.selectedNodeId
      ? findNodeById(studio.rootNode, selection.selectedNodeId)
      : null;
  const deleteCandidate =
    studio.rootNode && deleteCandidateId ? findNodeById(studio.rootNode, deleteCandidateId) : null;

  const contextActions = resolveStudioAppBarContextActions({
    selectedNodeId: selection.selectedNodeId,
    parentNodeId: selection.parentNodeId,
    canInsert,
    canInsertInside,
    canDelete,
    previewMode: studio.previewMode,
  });
  const modeAction = resolveStudioAppBarModeAction(studio.previewMode);

  const openInsert = useCallback(() => setInsertVisible(true), []);
  const openDelete = useCallback(() => {
    if (selection.selectedNodeId) setDeleteCandidateId(selection.selectedNodeId);
  }, [selection.selectedNodeId]);
  const confirmDelete = useCallback(() => {
    if (deleteCandidateId) studio.deleteNode(deleteCandidateId);
    setDeleteCandidateId(null);
  }, [deleteCandidateId, studio]);

  const getActionHandler = useCallback(
    (id: (typeof contextActions)[number]['id']) => {
      if (id === 'properties') return openProperties;
      if (id === 'bindings') return openBindings;
      if (id === 'insert') return openInsert;
      if (id === 'delete') return openDelete;
      if (id === 'selectParent') return selectParent;
      return clearSelection;
    },
    [clearSelection, openBindings, openDelete, openInsert, openProperties, selectParent],
  );

  const actions = isAdminPath
    ? null
    : [
        React.createElement(IconButton, {
          key: 'administration',
          icon: { name: 'settings-outline' },
          label: 'Administration',
          variant: 'ghost',
          color: 'neutral',
          onPress: openAdministration,
        }),
        React.createElement(IconButton, {
          key: 'preview-mode',
          icon: modeAction.icon,
          label: modeAction.label,
          variant: modeAction.variant,
          color: modeAction.color,
          onPress: studio.togglePreviewMode,
        }),
        ...contextActions.map((action) => {
          return React.createElement(IconButton, {
            key: action.id,
            icon: resolveContextActionIcon(action.id),
            label: action.label,
            variant: 'ghost',
            color: 'neutral',
            onPress: getActionHandler(action.id),
          });
        }),
      ];

  return {
    actions,
    overlays:
      isAdminPath || studio.previewMode
        ? null
        : React.createElement(
            React.Fragment,
            null,
            React.createElement(StudioInsertDialog, {
              componentMeta: studio.componentMeta,
              entries: resolvedInsertEntries,
              findNode: (id: string) =>
                studio.rootNode ? studio.findNode(studio.rootNode, id) : null,
              onDismiss: () => setInsertVisible(false),
              onInsert: (entry) => {
                const inserted = studio.insertFromCatalogEntry(entry);
                if (inserted) setInsertVisible(false);
                return inserted;
              },
              rootNode: studio.rootNode,
              visible: insertVisible,
            }),
            React.createElement(StudioDeleteDialog, {
              label: resolveNodeLabel({
                node: deleteCandidate ?? selectedNode,
                componentMeta: studio.componentMeta,
              }),
              onCancel: () => setDeleteCandidateId(null),
              onConfirm: confirmDelete,
              visible: deleteCandidate !== null,
            }),
          ),
  } satisfies StudioAppBarAugmentation;
}
