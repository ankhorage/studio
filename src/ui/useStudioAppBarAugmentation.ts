import { usePathname, useRouter } from 'expo-router';
import React, { useCallback } from 'react';

import { type StudioContextType, useStudio } from '../core/StudioContext';
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
import { createStudioAppBarActions } from './createStudioAppBarActions';
import { resolveStudioAppBarContextActions } from './studioAppBarModel';
import { StudioDeleteDialog } from './StudioDeleteDialog';
import { StudioInsertDialog } from './StudioInsertDialog';

export interface StudioAppBarAugmentation {
  actions?: React.ReactNode;
  overlays?: React.ReactNode;
}

type InsertEntries = ReturnType<typeof resolveInsertCatalogEntries>;

export function useStudioAppBarAugmentation(): StudioAppBarAugmentation {
  const studio = useStudio();
  const pathname = usePathname();
  const router = useRouter();
  const selection = createStudioSelectionContext({
    rootNode: studio.rootNode,
    selectedNodeId: studio.selectedNodeId,
  });
  const entries = useResolvedInsertEntries(studio, selection.selectedNodeId);
  const dialogs = useStudioAppBarDialogs(studio, selection.selectedNodeId);
  const contextActions = resolveStudioAppBarContextActions({
    selectedNodeId: selection.selectedNodeId,
    parentNodeId: selection.parentNodeId,
    ...resolveInsertCapabilities(entries, selection.selectedNodeId),
    canDelete: selection.selectedNodeId !== null && selection.parentNodeId !== null,
    previewMode: studio.previewMode,
  });
  const handlers = useStudioAppBarHandlers({
    studio,
    pathname,
    router,
    selectedNodeId: selection.selectedNodeId,
    parentNodeId: selection.parentNodeId,
    closeDialogs: dialogs.closeAll,
    openDelete: dialogs.openDelete,
    openInsert: dialogs.openInsert,
  });
  const isAdminPath = isStudioAdminPath(pathname);

  return {
    actions: isAdminPath
      ? null
      : createStudioAppBarActions(contextActions, handlers, studio.previewMode),
    overlays:
      isAdminPath || studio.previewMode
        ? null
        : createStudioAppBarOverlays(studio, entries, dialogs),
  } satisfies StudioAppBarAugmentation;
}

function useResolvedInsertEntries(studio: StudioContextType, selectedNodeId: string | null) {
  const catalogEntries = React.useMemo(
    () => buildInsertCatalogEntries({ componentMeta: studio.componentMeta }),
    [studio.componentMeta],
  );
  return React.useMemo(
    () =>
      resolveInsertCatalogEntries({
        entries: catalogEntries,
        root: studio.rootNode,
        selectedNodeId,
        componentMeta: studio.componentMeta,
      }),
    [catalogEntries, selectedNodeId, studio.componentMeta, studio.rootNode],
  );
}

function resolveInsertCapabilities(entries: InsertEntries, selectedNodeId: string | null) {
  const enabledEntries = entries.filter((entry) => entry.status === 'enabled');
  return {
    canInsert: enabledEntries.length > 0,
    canInsertInside: enabledEntries.some(
      (entry) => entry.placement?.kind === 'inside' && entry.placement.parentId === selectedNodeId,
    ),
  };
}

function useStudioAppBarDialogs(studio: StudioContextType, selectedNodeId: string | null) {
  const { deleteNode } = studio;
  const [insertVisible, setInsertVisible] = React.useState(false);
  const [deleteCandidateId, setDeleteCandidateId] = React.useState<StudioNodeId | null>(null);
  const openInsert = useCallback(() => setInsertVisible(true), []);
  const openDelete = useCallback(() => {
    if (selectedNodeId) setDeleteCandidateId(selectedNodeId);
  }, [selectedNodeId]);
  const closeAll = useCallback(() => {
    setInsertVisible(false);
    setDeleteCandidateId(null);
  }, []);
  const confirmDelete = useCallback(() => {
    if (deleteCandidateId) deleteNode(deleteCandidateId);
    setDeleteCandidateId(null);
  }, [deleteCandidateId, deleteNode]);

  return {
    insertVisible,
    deleteCandidateId,
    openInsert,
    openDelete,
    closeAll,
    confirmDelete,
    dismissInsert: () => setInsertVisible(false),
    dismissDelete: () => setDeleteCandidateId(null),
  };
}

function useStudioAppBarHandlers(args: {
  studio: StudioContextType;
  pathname: string;
  router: ReturnType<typeof useRouter>;
  selectedNodeId: string | null;
  parentNodeId: string | null;
  closeDialogs: () => void;
  openDelete: () => void;
  openInsert: () => void;
}) {
  const {
    studio,
    pathname,
    router,
    selectedNodeId,
    parentNodeId,
    closeDialogs,
    openDelete,
    openInsert,
  } = args;
  const {
    previewMode,
    selectNode,
    setActivePanelId,
    setLastNonAdminLocation,
    togglePreviewMode: togglePreview,
  } = studio;
  const openAdministration = useCallback(() => {
    const appLocation = resolveStudioLastNonAdminLocation({
      pathname,
      navigableLocation: resolveStudioNavigableLocation(pathname),
    });
    if (appLocation) setLastNonAdminLocation(appLocation);
    setActivePanelId(null);
    router.push('/ankh');
  }, [pathname, router, setActivePanelId, setLastNonAdminLocation]);
  const openBindings = useCallback(() => {
    if (selectedNodeId) router.push(createStudioBindingsRoutePath(selectedNodeId));
  }, [router, selectedNodeId]);
  const openProperties = useCallback(() => {
    if (selectedNodeId) router.push(createStudioPropertiesRoutePath(selectedNodeId));
  }, [router, selectedNodeId]);
  const clearSelection = useCallback(() => selectNode(null), [selectNode]);
  const selectParent = useCallback(() => {
    if (parentNodeId) selectNode(parentNodeId);
  }, [parentNodeId, selectNode]);
  const togglePreviewMode = useCallback(() => {
    if (!previewMode) {
      closeDialogs();
      setActivePanelId(null);
    }
    togglePreview();
  }, [closeDialogs, previewMode, setActivePanelId, togglePreview]);

  return {
    clearSelection,
    openAdministration,
    openBindings,
    openDelete,
    openInsert,
    openProperties,
    selectParent,
    togglePreviewMode,
  };
}

function createStudioAppBarOverlays(
  studio: StudioContextType,
  entries: InsertEntries,
  dialogs: ReturnType<typeof useStudioAppBarDialogs>,
): React.ReactNode {
  const selectedNode =
    studio.rootNode && studio.selectedNodeId
      ? findNodeById(studio.rootNode, studio.selectedNodeId)
      : null;
  const deleteCandidate =
    studio.rootNode && dialogs.deleteCandidateId
      ? findNodeById(studio.rootNode, dialogs.deleteCandidateId)
      : null;

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(StudioInsertDialog, {
      componentMeta: studio.componentMeta,
      entries,
      findNode: (id: string) => (studio.rootNode ? studio.findNode(studio.rootNode, id) : null),
      onDismiss: dialogs.dismissInsert,
      onInsert: (entry) => {
        const inserted = studio.insertFromCatalogEntry(entry);
        if (inserted) dialogs.dismissInsert();
        return inserted;
      },
      rootNode: studio.rootNode,
      visible: dialogs.insertVisible,
    }),
    React.createElement(StudioDeleteDialog, {
      label: resolveNodeLabel({
        node: deleteCandidate ?? selectedNode,
        componentMeta: studio.componentMeta,
      }),
      onCancel: dialogs.dismissDelete,
      onConfirm: dialogs.confirmDelete,
      visible: deleteCandidate !== null,
    }),
  );
}
