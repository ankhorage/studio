import { describe, expect, test } from 'bun:test';

import { createStudioSelectionProviderProps } from './studioSelectionModel';

describe('studioSelectionModel', () => {
  test('maps preview mode to disabled empty selection', () => {
    const props = createStudioSelectionProviderProps({
      previewMode: true,
      selectedNodeId: 'node-1',
      selectNode: () => undefined,
    });

    expect(props).toMatchObject({
      mode: 'single',
      disabled: true,
      selectedIds: [],
    });
    expect(props.onSelectionChange).toBeUndefined();
  });

  test('maps edit mode selection changes', () => {
    const calls: Array<string | null> = [];
    const props = createStudioSelectionProviderProps({
      previewMode: false,
      selectedNodeId: 'node-1',
      selectNode: (nodeId) => calls.push(nodeId),
    });

    expect(props.disabled).toBe(false);
    expect(props.selectedIds).toEqual(['node-1']);
    expect(props.onSelectionChange).toBeDefined();

    const handleChange = props.onSelectionChange;
    if (!handleChange) {
      throw new Error('Expected selection handler');
    }

    handleChange(['node-2']);
    handleChange([]);

    expect(calls).toEqual(['node-2', null]);
  });
});
