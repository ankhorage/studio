import { describe, expect, test } from 'bun:test';

import { createStudioSelectionProviderProps } from './studioSelectionModel';

describe('studioSelectionModel', () => {
  test('creates disabled preview selection props', () => {
    const props = createStudioSelectionProviderProps({
      previewMode: true,
      selectedNodeId: 'node-1',
      selectNode: () => undefined,
    });

    expect(props.mode).toBe('single');
    expect(props.disabled).toBe(true);
    expect(props.selectedIds).toEqual([]);
    expect(props.onSelectionChange).toBeUndefined();
  });

  test('creates editable selection props', () => {
    const selected: (string | null)[] = [];
    const props = createStudioSelectionProviderProps({
      previewMode: false,
      selectedNodeId: 'node-1',
      selectNode: (nodeId) => selected.push(nodeId),
    });

    expect(props.disabled).toBe(false);
    expect(props.selectedIds).toEqual(['node-1']);

    if (!props.onSelectionChange) {
      throw new Error('Expected onSelectionChange handler');
    }

    props.onSelectionChange(['node-2']);
    props.onSelectionChange([]);

    expect(selected).toEqual(['node-2', null]);
  });

  test('creates editable empty selection props', () => {
    const selected: (string | null)[] = [];
    const props = createStudioSelectionProviderProps({
      previewMode: false,
      selectedNodeId: null,
      selectNode: (nodeId) => selected.push(nodeId),
    });

    expect(props.disabled).toBe(false);
    expect(props.selectedIds).toEqual([]);

    if (!props.onSelectionChange) {
      throw new Error('Expected onSelectionChange handler');
    }

    props.onSelectionChange([]);

    expect(selected).toEqual([null]);
  });
});
