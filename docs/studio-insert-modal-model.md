# Studio insert modal model

`@ankhorage/studio/insertModalModel` provides package-neutral helpers for preparing insert catalog entries for insert modal UIs.

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

## Host-owned concerns

Hosts still own rendering modals, search input state, selected category UI, concrete component metadata such as Zora metadata, and insert execution.
