export interface StudioAppBarContextAction {
  readonly id: 'properties' | 'selectParent' | 'clearSelection';
  readonly label: string;
}

export interface ResolveStudioAppBarContextActionsArgs {
  readonly pathname: string;
  readonly selectedNodeId: string | null;
  readonly parentNodeId: string | null;
  readonly onAdministration: () => void;
  readonly onProperties: () => void;
  readonly onSelectParent: () => void;
  readonly onClearSelection: () => void;
}

export function resolveStudioAppBarContextActions(
  args: ResolveStudioAppBarContextActionsArgs,
): StudioAppBarContextAction[] {
  const actions: StudioAppBarContextAction[] = [{ id: 'properties', label: 'Properties' }];

  if (args.parentNodeId) {
    actions.push({ id: 'selectParent', label: 'Select parent' });
  }

  actions.push({ id: 'clearSelection', label: 'Clear selection' });
  return actions;
}
