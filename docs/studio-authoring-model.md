# Studio authoring model

This package now owns the package-neutral Studio authoring/model helpers used by host apps to edit manifests and UI node trees.

## Owned here

`@ankhorage/studio` owns the reusable authoring logic that does not need React, React Native, Expo, DnD, Supabase, generated-app runtime composition code, or host-app modules:

- action registry and action definitions
- component metadata contract shape used by authoring helpers
- empty screen starter template
- Studio ID generation helper
- UI tree helpers for cloning, finding, updating, removing, adding, and moving nodes
- node placement validation/resolution
- insert catalog entry construction and placement resolution
- catalog entry node creation

## Host-owned inputs

The package intentionally does not import Zora or any concrete component registry. Host packages pass component metadata through `StudioComponentMetaRegistry` when resolving placement, building insert catalog entries, or creating nodes.

This keeps `@ankhorage/studio` as the authoring-model owner while letting `ankhorage4` and future hosts decide which component registry powers the Studio catalog.

## Deliberately not moved here

This slice still does not move product shell or platform code. In particular, this package still does not own:

- `AnkhStudio`
- `StudioApp`
- Studio workspace route screens
- admin screens
- panels
- React Native components
- Expo Router code
- DnD provider/runtime implementation
- Supabase/storage implementation
- generated-app runtime composition code
- template catalog ownership

## Dependency rule

The authoring model may depend on `@ankhorage/contracts` for manifest and `UiNode` types. It must not import React, React Native, Expo, DnD, Supabase, Zora implementation modules, generated-app runtime composition code, or host-app implementation modules.
