export interface StudioAppBarContextAction {
  readonly id: 'properties' | 'bindings' | 'insert' | 'delete' | 'selectParent' | 'clearSelection';
  readonly label: string;
}

export interface ResolveStudioAppBarContextActionsArgs {
  readonly selectedNodeId: string | null;
  readonly parentNodeId: string | null;
  readonly canInsert: boolean;
  readonly canInsertInside: boolean;
  readonly canDelete: boolean;
}

export function resolveStudioAppBarContextActions(
  args: ResolveStudioAppBarContextActionsArgs,
): StudioAppBarContextAction[] {
  if (!args.selectedNodeId) {
    return [];
  }

  const actions: StudioAppBarContextAction[] = [
    { id: 'properties', label: 'Properties' },
    { id: 'bindings', label: 'Bindings' },
  ];

  if (args.canInsert) {
    actions.push({ id: 'insert', label: args.canInsertInside ? 'Add child' : 'Insert' });
  }

  if (args.canDelete) {
    actions.push({ id: 'delete', label: 'Delete' });
  }

  if (args.parentNodeId) {
    actions.push({ id: 'selectParent', label: 'Select parent' });
  }

  actions.push({ id: 'clearSelection', label: 'Clear selection' });
  return actions;
}
