import { IconButton, type IconButtonProps } from '@ankhorage/zora';
import React from 'react';

import { resolveStudioAppBarModeAction, type StudioAppBarContextAction } from './studioAppBarModel';

type AppBarHandlers = Readonly<{
  clearSelection: () => void;
  openAdministration: () => void;
  openBindings: () => void;
  openDelete: () => void;
  openInsert: () => void;
  openProperties: () => void;
  selectParent: () => void;
  togglePreviewMode: () => void;
}>;

export function createStudioAppBarActions(
  contextActions: StudioAppBarContextAction[],
  handlers: AppBarHandlers,
  previewMode: boolean,
): React.ReactNode[] {
  const modeAction = resolveStudioAppBarModeAction(previewMode);
  return [
    React.createElement(IconButton, {
      key: 'administration',
      icon: { name: 'settings-outline' },
      label: 'Administration',
      variant: 'ghost',
      color: 'neutral',
      onPress: handlers.openAdministration,
    }),
    React.createElement(IconButton, {
      key: 'preview-mode',
      icon: modeAction.icon,
      label: modeAction.label,
      variant: modeAction.variant,
      color: modeAction.color,
      onPress: handlers.togglePreviewMode,
    }),
    ...contextActions.map((action) =>
      React.createElement(IconButton, {
        key: action.id,
        icon: resolveContextActionIcon(action.id),
        label: action.label,
        variant: 'ghost',
        color: 'neutral',
        onPress: resolveContextActionHandler(action.id, handlers),
      }),
    ),
  ];
}

function resolveContextActionHandler(
  id: StudioAppBarContextAction['id'],
  handlers: AppBarHandlers,
) {
  if (id === 'properties') return handlers.openProperties;
  if (id === 'bindings') return handlers.openBindings;
  if (id === 'insert') return handlers.openInsert;
  if (id === 'delete') return handlers.openDelete;
  if (id === 'selectParent') return handlers.selectParent;
  return handlers.clearSelection;
}

function resolveContextActionIcon(id: StudioAppBarContextAction['id']): IconButtonProps['icon'] {
  if (id === 'properties') return { name: 'options-outline' };
  if (id === 'bindings') return { name: 'git-branch-outline' };
  if (id === 'insert') return { name: 'add-outline' };
  if (id === 'delete') return { name: 'trash-outline' };
  if (id === 'selectParent') return { name: 'arrow-up-outline' };
  return { name: 'close-outline' };
}
