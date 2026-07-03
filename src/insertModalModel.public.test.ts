import type { UiNode } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import type { InsertCatalogEntry, StudioComponentMetaRegistry } from './index';
import type { InsertCategoryGroup } from './insertModalModel';
import {
  filterInsertCatalogEntries,
  getPlacementHint,
  groupInsertEntries,
  resolveNodeLabel,
} from './insertModalModel';

describe('insert modal model public exports', () => {
  test('types and helpers are usable from the public module', () => {
    const componentMeta: StudioComponentMetaRegistry = {
      Box: { category: 'component', allowedChildren: [], blueprint: { label: 'Box' } },
    };
    const entry: InsertCatalogEntry = {
      id: 'component:Box',
      label: 'Box',
      category: 'component',
      rootType: 'Box',
      kind: 'component',
      componentType: 'Box',
      status: 'enabled',
      placement: { parentId: 'root', index: 0, kind: 'inside' },
    };
    const rootNode: UiNode = { id: 'root', type: 'Box' };
    const groups: InsertCategoryGroup[] = groupInsertEntries({
      entries: [entry],
      getCategoryLabel: (category) => category,
    });

    expect(filterInsertCatalogEntries([entry], 'box')).toEqual([entry]);
    expect(groups[0]?.category).toBe('component');
    expect(resolveNodeLabel({ node: rootNode, componentMeta })).toBe('Box');
    expect(
      getPlacementHint({
        entry,
        rootNode,
        findNode: (root) => root,
        componentMeta,
      }),
    ).toBe('Inserts inside Box');
  });
});
