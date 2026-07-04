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

const EMPTY_IDS: readonly string[] = [];

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
