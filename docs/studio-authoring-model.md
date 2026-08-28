# Studio authoring model

This package owns the package-neutral Studio authoring/model helpers used by host apps to edit manifests and UI node trees.

## Owned here

`@ankhorage/studio` owns the reusable authoring logic that does not need React, React Native, Expo, DnD, Supabase, generated-app runtime composition code, or host-app modules:

- action registry and action definitions
- component metadata contract shape used by authoring helpers
- empty screen starter template
- Studio ID generation helper
- UI tree helpers for cloning, finding, updating, removing, inserting, and placement-backed moving
- node placement validation/resolution
- insert catalog entry construction and placement resolution
- catalog entry node creation

## Host-owned inputs

The package intentionally does not import Zora or any concrete component registry. Host packages pass component metadata through `StudioComponentMetaRegistry` when resolving placement, building insert catalog entries, or creating nodes.

This keeps `@ankhorage/studio` as the authoring-model owner while letting the first-party Studio app
and generated app hosts inject the same component registry that powers their Runtime rendering.

Placement mutation is intentionally singular. `insertNodeAtPlacement`,
`resolveMoveNodePlacement`, and `moveNodeToPlacement` are the canonical tree APIs.

## Deliberately not moved here

This package does not own product shell or platform code. In particular, it does not own:

- `AnkhStudio`
- `StudioApp`
- Studio workspace route screens
- admin screens
- panels
- React Native components
- Expo Router code
- package-neutral DnD provider/runtime implementation
- Supabase/storage implementation
- generated-app runtime composition code
- template catalog ownership

The local generated Studio runtime may compose the shared cross-platform DnD adapter directly for
its app-facing canvas UI. That integration does not change ownership of the package-neutral tree
and placement model.

## Dependency rule

The authoring model may depend on `@ankhorage/contracts` for manifest and `UiNode` types. It must not import React, React Native, Expo, DnD, Supabase, Zora implementation modules, generated-app runtime composition code, or host-app implementation modules.
