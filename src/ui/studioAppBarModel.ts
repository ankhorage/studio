export interface StudioAppBarContextAction {
  readonly id: 'properties' | 'selectParent' | 'clearSelection';
  readonly label: string;
}

export interface ResolveStudioAppBarContextActionsArgs {
  readonly selectedNodeId: string | null;
  readonly parentNodeId: string | null;
}

export function resolveStudioAppBarContextActions(
  args: ResolveStudioAppBarContextActionsArgs,
): StudioAppBarContextAction[] {
  if (!args.selectedNodeId) {
    return [];
  }

  const actions: StudioAppBarContextAction[] = [{ id: 'properties', label: 'Properties' }];

  if (args.parentNodeId) {
    actions.push({ id: 'selectParent', label: 'Select parent' });
  }

  actions.push({ id: 'clearSelection', label: 'Clear selection' });
  return actions;
}
