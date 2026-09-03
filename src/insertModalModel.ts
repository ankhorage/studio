import type { UiNode } from '@ankhorage/contracts';

import type { InsertCatalogEntry, StudioComponentMetaRegistry } from './index';

export interface InsertCategoryGroup {
  category: string;
  label: string;
  entries: InsertCatalogEntry[];
}

/***
 * Filter catalog entries by a normalized query across selected string fields.
 * @utility @ankhorage/utility/search
 */
export function filterInsertCatalogEntries(
  entries: InsertCatalogEntry[],
  query: string,
): InsertCatalogEntry[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length === 0) {
    return entries;
  }

  return entries.filter((entry) => {
    const description = entry.description?.toLowerCase() ?? '';
    return (
      entry.label.toLowerCase().includes(normalizedQuery) ||
      entry.rootType.toLowerCase().includes(normalizedQuery) ||
      description.includes(normalizedQuery)
    );
  });
}

/***
 * Group entries by category while preserving first-seen group order and resolving a label per group.
 * @utility @ankhorage/utility/collection
 */
export function groupInsertEntries(args: {
  entries: InsertCatalogEntry[];
  getCategoryLabel: (category: string) => string;
}): InsertCategoryGroup[] {
  const { entries, getCategoryLabel } = args;
  const groups: InsertCategoryGroup[] = [];
  const byCategory = new Map<string, InsertCategoryGroup>();

  for (const entry of entries) {
    const existing = byCategory.get(entry.category);
    if (existing) {
      existing.entries.push(entry);
      continue;
    }

    const group: InsertCategoryGroup = {
      category: entry.category,
      label: getCategoryLabel(entry.category),
      entries: [entry],
    };
    byCategory.set(entry.category, group);
    groups.push(group);
  }

  return groups;
}

/***
 * Resolve the authored display label for a Studio node using alias, component metadata, type, or fallback.
 * @todo Keep Studio node-label policy with canvas/insert authoring rather than a root model file.
 */
export function resolveNodeLabel(args: {
  node: UiNode | null;
  componentMeta: StudioComponentMetaRegistry;
  fallbackLabel?: string;
}): string {
  const { node, componentMeta, fallbackLabel = 'selection' } = args;
  if (!node) return fallbackLabel;

  return node.alias ?? componentMeta[node.type]?.blueprint?.label ?? node.type;
}

/***
 * Describe where an enabled insert-catalog entry will be placed relative to its resolved target node.
 * @todo Move insert-placement presentation under src/canvas/ or the owning insert authoring responsibility.
 */
export function getPlacementHint(args: {
  entry: InsertCatalogEntry;
  rootNode: UiNode | null;
  findNode: (root: UiNode, id: string) => UiNode | null;
  componentMeta: StudioComponentMetaRegistry;
}): string | null {
  const { entry, rootNode, findNode, componentMeta } = args;

  if (entry.status !== 'enabled' || !entry.placement || !rootNode) {
    return null;
  }

  const { placement } = entry;
  const targetId =
    placement.kind === 'inside'
      ? placement.parentId
      : (placement.referenceId ?? placement.parentId);
  const targetNode = findNode(rootNode, targetId);
  const targetLabel = resolveNodeLabel({ node: targetNode, componentMeta });

  if (placement.kind === 'before') {
    return `Inserts before ${targetLabel}`;
  }

  if (placement.kind === 'after') {
    return `Inserts after ${targetLabel}`;
  }

  return `Inserts inside ${targetLabel}`;
}
