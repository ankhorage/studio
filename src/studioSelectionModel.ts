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

function containsUiNode(rootNode: UiNode | null, selectedNodeId: string | null): boolean {
  if (!rootNode || !selectedNodeId) return false;
  if (rootNode.id === selectedNodeId) return true;

  const visit = (node: UiNode): boolean => {
    if (node.id === selectedNodeId) return true;
    for (const child of node.children ?? []) {
      if (visit(child)) {
        return true;
      }
    }
    return false;
  };

  return visit(rootNode);
}

export function resolveStudioSelectionParentNodeId(
  rootNode: UiNode | null,
  selectedNodeId: string | null,
): string | null {
  if (!rootNode || !selectedNodeId || !containsUiNode(rootNode, selectedNodeId)) return null;
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

export function resolveStudioSelectedNodeId(
  rootNode: UiNode | null,
  selectedNodeId: string | null,
): string | null {
  return containsUiNode(rootNode, selectedNodeId) ? selectedNodeId : null;
}

export function createStudioSelectionContext(args: {
  readonly rootNode: UiNode | null;
  readonly selectedNodeId: string | null;
}): StudioSelectionContext {
  const selectedNodeId = resolveStudioSelectedNodeId(args.rootNode, args.selectedNodeId);
  const parentNodeId = resolveStudioSelectionParentNodeId(args.rootNode, selectedNodeId);

  return {
    selectedNodeId,
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
