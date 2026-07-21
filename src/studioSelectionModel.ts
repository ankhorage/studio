import type { UiNode } from '@ankhorage/contracts';

export interface StudioSelectionProviderAdapterProps {
  mode: 'single';
  disabled: boolean;
  selectedIds: readonly string[];
  onSelectionChange?: (ids: readonly string[]) => void;
}

export interface CreateStudioSelectionProviderPropsArgs {
  previewMode: boolean;
  selectedNodeId: string | null;
  selectNode: (id: string | null) => void;
}

export interface StudioSelectionContext {
  readonly selectedNodeId: string | null;
  readonly parentNodeId: string | null;
  readonly canSelectParent: boolean;
}

const EMPTY_IDS: readonly string[] = [];

export function resolveStudioSelectionParentNodeId(
  rootNode: UiNode | null,
  selectedNodeId: string | null,
): string | null {
  if (!rootNode || !selectedNodeId) return null;
  if (rootNode.id === selectedNodeId) return null;

  const visit = (node: UiNode, parentId: string | null): string | null => {
    if (node.id === selectedNodeId) return parentId;
    for (const child of node.children ?? []) {
      const parentCandidate = visit(child, node.id);
      if (parentCandidate !== null || child.id === selectedNodeId) {
        return parentCandidate;
      }
    }
    return null;
  };

  return visit(rootNode, null);
}

export function createStudioSelectionContext(args: {
  readonly rootNode: UiNode | null;
  readonly selectedNodeId: string | null;
}): StudioSelectionContext {
  const parentNodeId = resolveStudioSelectionParentNodeId(args.rootNode, args.selectedNodeId);

  return {
    selectedNodeId: args.selectedNodeId,
    parentNodeId,
    canSelectParent: parentNodeId !== null,
  };
}

export function createStudioSelectionProviderProps(
  args: CreateStudioSelectionProviderPropsArgs,
): StudioSelectionProviderAdapterProps {
  const { previewMode, selectedNodeId, selectNode } = args;

  return {
    mode: 'single',
    disabled: previewMode,
    selectedIds: previewMode ? EMPTY_IDS : selectedNodeId ? [selectedNodeId] : EMPTY_IDS,
    onSelectionChange: previewMode
      ? undefined
      : (ids) => {
          selectNode(ids[0] ?? null);
        },
  };
}
