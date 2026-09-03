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

/***
 * Test whether a selected id exists in a node tree.
 * @utility @ankhorage/utility/tree
 */
function containsUiNode(rootNode: UiNode | null, selectedNodeId: string | null): boolean {
  if (!rootNode || !selectedNodeId) return false;
  if (rootNode.id === selectedNodeId) return true;

  /***
   * Recursively visit a tree until the selected id is found.
   * @utility @ankhorage/utility/tree
   */
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

/***
 * Find the parent id of a selected node in a tree while treating the root as parentless.
 * @utility @ankhorage/utility/tree
 */
export function resolveStudioSelectionParentNodeId(
  rootNode: UiNode | null,
  selectedNodeId: string | null,
): string | null {
  if (!rootNode || !selectedNodeId || !containsUiNode(rootNode, selectedNodeId)) return null;
  if (rootNode.id === selectedNodeId) return null;

  /***
   * Recursively search a tree while carrying the current parent id.
   * @utility @ankhorage/utility/tree
   */
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

/***
 * Keep a selected id only while that id still exists in the current tree.
 * @utility @ankhorage/utility/tree
 */
export function resolveStudioSelectedNodeId(
  rootNode: UiNode | null,
  selectedNodeId: string | null,
): string | null {
  return containsUiNode(rootNode, selectedNodeId) ? selectedNodeId : null;
}

/***
 * Build a selection context containing the valid selected id and its parent relationship.
 * @utility @ankhorage/utility/tree
 */
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

/***
 * Adapt nullable single-selection state to a provider that represents selection as an id array.
 * @utility @ankhorage/utility/selection
 */
export function createStudioSelectionProviderProps(
  args: CreateStudioSelectionProviderPropsArgs,
): StudioSelectionProviderAdapterProps {
  const { previewMode, selectedNodeId, selectNode } = args;

  return {
    mode: 'single',
    disabled: previewMode,
    selectedIds: previewMode ? EMPTY_IDS : selectedNodeId ? [selectedNodeId] : EMPTY_IDS,
    /*** Forward the provider's first selected id into nullable single-selection state. */
    onSelectionChange: previewMode
      ? undefined
      : (ids) => {
          selectNode(ids[0] ?? null);
        },
  };
}
