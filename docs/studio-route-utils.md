# Studio route utilities

`@ankhorage/studio/routeUtils` provides package-neutral helpers for inspecting and transforming Studio route trees.

## Import

```ts
import {
  collectScreenRouteEntries,
  resolveScreenIdForPathname,
} from '@ankhorage/studio/routeUtils';

import { resolveInitialScreenId } from '@ankhorage/studio/manifestState';
```

## Owned here

- route entry collection and grouping
- route parent path lookups
- navigator lookup/update helpers
- unique route-name helpers
- route cleanup helpers
- recursive pathname-to-screen resolution across Stack, Tabs, Drawer, and route-group nesting

## Active screen resolution

`resolveScreenIdForPathname(navigator, pathname, screens?)` resolves the leaf screen from the
canonical manifest route tree. It supports nested index routes, explicit child routes, Expo-style
dynamic and catch-all segments, route groups, static-route precedence over dynamic siblings, query
strings, hashes, and trailing slashes. When a screen registry is supplied, routes whose screen ID is
absent are ignored and the canonical registry-key-equals-`ScreenSpec.id` invariant is required.
Malformed registries return `null`, so pathname resolution cannot turn a registry key into an
accidental Studio screen identity.

The root pathname fallback uses `resolveInitialScreenId(navigator, screens?)`, the same pure helper
used by Studio's initial active-screen resolution. It respects `initialRouteName` at every Stack,
Tabs, or Drawer level, follows route-group and nested-navigator wrappers to a leaf, and falls back to
the first route that reaches an available screen when an initial route is absent or unusable.

Generated Studio shells pass the current non-admin app pathname to `StudioProvider`. While a path is
present, path-derived screen context takes precedence over an explicitly requested screen. When an
admin route is open, the path input is omitted and the provider preserves the last requested valid
app screen; direct admin entry falls back to the canonical recursive initial leaf. Every active-root
change reconciles selection, so node IDs that do not belong to the new root are cleared.

## Host-owned concerns

Hosts still own React panels, drag/drop gestures, visual ordering controls, and persistence side effects.
