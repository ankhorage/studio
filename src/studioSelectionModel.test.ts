import { describe, expect, test } from 'bun:test';

import {
  createStudioSelectionContext,
  createStudioSelectionProviderProps,
  resolveStudioSelectionParentNodeId,
} from './studioSelectionModel';

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

  test('resolves parent node ids for descendants and root nodes', () => {
    const root = {
      id: 'root',
      type: 'Screen',
      props: {},
      children: [
        {
          id: 'section',
          type: 'Section',
          props: {},
          children: [{ id: 'text', type: 'Text', props: {} }],
        },
      ],
    };

    expect(resolveStudioSelectionParentNodeId(root, 'section')).toBe('root');
    expect(resolveStudioSelectionParentNodeId(root, 'text')).toBe('section');
    expect(resolveStudioSelectionParentNodeId(root, 'missing')).toBeNull();
    expect(resolveStudioSelectionParentNodeId(root, null)).toBeNull();
  });

  test('creates a selection context that exposes parent selection availability', () => {
    const root = {
      id: 'root',
      type: 'Screen',
      props: {},
      children: [{ id: 'child', type: 'View', props: {} }],
    };

    const selection = createStudioSelectionContext({ rootNode: root, selectedNodeId: 'child' });

    expect(selection.selectedNodeId).toBe('child');
    expect(selection.parentNodeId).toBe('root');
    expect(selection.canSelectParent).toBe(true);

    const empty = createStudioSelectionContext({ rootNode: root, selectedNodeId: 'root' });
    expect(empty.parentNodeId).toBeNull();
    expect(empty.canSelectParent).toBe(false);
  });

  test('reconciles stale selections against the current root node', () => {
    const root = {
      id: 'root',
      type: 'Screen',
      props: {},
      children: [{ id: 'child', type: 'View', props: {} }],
    };

    const selection = createStudioSelectionContext({ rootNode: root, selectedNodeId: 'missing' });

    expect(selection.selectedNodeId).toBeNull();
    expect(selection.parentNodeId).toBeNull();
    expect(selection.canSelectParent).toBe(false);
  });
});
