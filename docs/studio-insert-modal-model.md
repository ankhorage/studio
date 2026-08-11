# Studio insert modal model

`@ankhorage/studio/insertModalModel` provides package-neutral helpers for preparing insert catalog
entries for contextual Insert UI.

## Import

```ts
import {
  filterInsertCatalogEntries,
  getPlacementHint,
  groupInsertEntries,
} from '@ankhorage/studio/insertModalModel';
```

## Owned here

- filtering insert catalog entries by label, root type, or description
- grouping entries while letting the host provide category labels
- resolving node display labels from aliases and component metadata
- formatting placement hints for enabled catalog entries

## Studio integration

The first-party Studio shell renders the contextual Insert surface with ordinary ZORA `Modal`,
`Input`, `ListSection`, and `ListRow` components. The app bar says **Add child** when the selected
node accepts a direct child and **Insert** when placement falls back to an ancestor or sibling.
Search and category state are transient; enabled rows show their resolved placement hint, while
disabled rows retain the catalog's exact explanation.

`StudioProvider` receives concrete component metadata from the generated app and exposes the
package-neutral catalog, insert, delete, and placement-backed move capabilities through the Studio
context. Insertion creates nodes from the catalog blueprint and defaults, persists through the
canonical manifest placement mutation, and selects the inserted node. Deletion uses a ZORA
confirmation dialog, rejects the screen root, removes the complete subtree and its bindings, and
selects the deleted node's former parent.

There is no parallel Toolbox or Studio-only component registry. Hosts still own which concrete
metadata registry they inject and where the contextual app-bar augmentation is mounted.
