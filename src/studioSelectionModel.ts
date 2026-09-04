import type { UiNode } from '@ankhorage/contracts';
import { arrayToSingleSelection, singleSelectionToArray } from '@ankhorage/utility/selection';
import { findTreeNodeWithParent, type TreeAdapter, treeContainsId } from '@ankhorage/utility/tree';

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
const uiNodeTreeAdapter: TreeAdapter<UiNode> = {
  getId: (node) => node.id,
  getChildren: (node) => node.children,
  withChildren: (node, children) => ({ ...node, children: [...children] }),
};

/***
 * Test whether a selected id exists in a node tree.
 * @utility @ankhorage/utility/tree
 */
function containsUiNode(rootNode: UiNode | null, selectedNodeId: string | null): boolean {
  if (!rootNode || !selectedNodeId) return false;
  return treeContainsId(rootNode, selectedNodeId, uiNodeTreeAdapter);
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
  return findTreeNodeWithParent(rootNode, selectedNodeId, uiNodeTreeAdapter)?.parent?.id ?? null;
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
    selectedIds: previewMode ? EMPTY_IDS : singleSelectionToArray(selectedNodeId),
    /*** Forward the provider's first selected id into nullable single-selection state. */
    onSelectionChange: previewMode
      ? undefined
      : (ids) => {
          selectNode(arrayToSingleSelection(ids));
        },
  };
}
