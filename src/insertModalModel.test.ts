import type { UiNode } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import type { InsertCatalogEntry, StudioComponentMetaRegistry } from './index';
import {
  filterInsertCatalogEntries,
  getPlacementHint,
  groupInsertEntries,
  resolveNodeLabel,
} from './insertModalModel';

const componentMeta: StudioComponentMetaRegistry = {
  Box: { category: 'component', allowedChildren: [], blueprint: { label: 'Box' } },
  Image: { category: 'component', allowedChildren: [], blueprint: { label: 'Image' } },
};

const BOX_ENTRY: InsertCatalogEntry = {
  id: 'component:Box',
  label: 'Box',
  category: 'component',
  rootType: 'Box',
  kind: 'component',
  componentType: 'Box',
  status: 'enabled',
};

const IMAGE_ENTRY: InsertCatalogEntry = {
  id: 'component:Image',
  label: 'Image',
  description: 'Visual asset',
  category: 'component',
  rootType: 'Image',
  kind: 'component',
  componentType: 'Image',
  status: 'enabled',
};

describe('insertModalModel', () => {
  test('filters entries by label, type, and description', () => {
    const entries = [BOX_ENTRY, IMAGE_ENTRY];

    expect(filterInsertCatalogEntries(entries, 'box')).toEqual([BOX_ENTRY]);
    expect(filterInsertCatalogEntries(entries, 'image')).toEqual([IMAGE_ENTRY]);
    expect(filterInsertCatalogEntries(entries, 'visual')).toEqual([IMAGE_ENTRY]);
    expect(filterInsertCatalogEntries(entries, '')).toBe(entries);
  });

  test('groups entries with caller-owned category labels', () => {
    const groups = groupInsertEntries({
      entries: [{ ...BOX_ENTRY, category: 'layout' }, IMAGE_ENTRY],
      getCategoryLabel: (category) => (category === 'layout' ? 'Layout' : 'Components'),
    });

    expect(groups.map((group) => group.label)).toEqual(['Layout', 'Components']);
  });

  test('resolves labels from aliases, metadata, and fallback type', () => {
    expect(
      resolveNodeLabel({
        node: { id: 'box', type: 'Box', alias: 'Hero box' },
        componentMeta,
      }),
    ).toBe('Hero box');
    expect(resolveNodeLabel({ node: { id: 'box', type: 'Box' }, componentMeta })).toBe('Box');
    expect(resolveNodeLabel({ node: { id: 'unknown', type: 'Unknown' }, componentMeta })).toBe(
      'Unknown',
    );
    expect(resolveNodeLabel({ node: null, componentMeta })).toBe('selection');
  });

  test('formats placement hints for enabled entries', () => {
    const rootNode: UiNode = { id: 'root', type: 'Box', children: [] };
    const findNode = (root: UiNode, id: string): UiNode | null => (root.id === id ? root : null);
    const entry: InsertCatalogEntry = {
      ...BOX_ENTRY,
      placement: {
        parentId: 'root',
        index: 0,
        kind: 'inside',
      },
    };

    expect(getPlacementHint({ entry, rootNode, findNode, componentMeta })).toBe(
      'Inserts inside Box',
    );
  });
});
