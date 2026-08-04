# Studio route utilities

`@ankhorage/studio/routeUtils` provides package-neutral helpers for inspecting and transforming Studio route trees.

## Import

```ts
import {
  collectScreenRouteEntries,
  reorderLeafRoutesWithinParent,
  resolveScreenIdForPathname,
} from '@ankhorage/studio/routeUtils';
```

## Owned here

- route entry collection and grouping
- route parent path lookups
- navigator lookup/update helpers
- unique route-name helpers
- route cleanup helpers
- leaf-route reordering within a selected parent path
- recursive pathname-to-screen resolution across Stack, Tabs, Drawer, and route-group nesting

## Active screen resolution

`resolveScreenIdForPathname(navigator, pathname)` resolves the leaf screen from the canonical
manifest route tree. It supports nested index routes, explicit child routes, Expo-style dynamic
segments such as `[id]`, route groups, static-route precedence over dynamic siblings, and recursive
initial-route fallback for the root pathname.

Generated Studio shells pass the current non-admin app pathname to `StudioProvider`. The provider
derives `activeScreenId` from this shared model, retains the last valid app screen while an admin
route is open, and reconciles selection against the newly active screen root when app navigation
changes.

## Host-owned concerns

Hosts still own React panels, drag/drop gestures, visual ordering controls, and persistence side effects.

## Leaf route reorder

`reorderLeafRoutesWithinParent(routes, parentPath, orderedRouteNames)` only reorders routes whose names are listed in `orderedRouteNames` within the selected parent path. Routes not listed in the order remain in place.
