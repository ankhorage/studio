# Studio route utilities

`@ankhorage/studio/routeUtils` provides package-neutral helpers for inspecting and transforming Studio route trees.

## Import

```ts
import {
  collectScreenRouteEntries,
  reorderLeafRoutesWithinParent,
} from '@ankhorage/studio/routeUtils';
```

## Owned here

- route entry collection and grouping
- route parent path lookups
- navigator lookup/update helpers
- unique route-name helpers
- route cleanup helpers
- leaf-route reordering within a selected parent path

## Host-owned concerns

Hosts still own React panels, drag/drop gestures, visual ordering controls, and persistence side effects.

## Leaf route reorder

`reorderLeafRoutesWithinParent(routes, parentPath, orderedRouteNames)` only reorders routes whose names are listed in `orderedRouteNames` within the selected parent path. Routes not listed in the order remain in place.
