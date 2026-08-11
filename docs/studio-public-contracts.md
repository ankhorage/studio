# Studio public contracts

This package now owns the first package-neutral Studio authoring contracts for the Phase 6
extraction.

## Owned here

`@ankhorage/studio` owns Studio product and authoring contracts that host apps need in order
to integrate the Studio package boundary:

- package boundary metadata
- project/session identifiers
- Studio mode, panel, admin route, selection, and save status types
- manifest editing contracts
- node placement contracts
- insert catalog entry contracts
- Studio command/event contracts
- the type-only context value shape

`StudioContextValue` now carries the caller-injected `componentMeta` registry and concrete
`insertFromCatalogEntry`, `moveNodeToPlacement`, and `deleteNode` capabilities. `StudioProvider`
requires that registry so the generated Studio app uses the same component rules as its Runtime.
`resolveMoveNodePlacement` is public for validating and normalizing a placement before mutation;
`invalid-reference` identifies incoherent sibling references.

The obsolete `addNodeToTree`, `moveNodeInTree`, directional `moveStudioManifestNode`, and
`StudioContextValue.moveNode` APIs have been removed. The `@ankhorage/studio/dnd`,
`@ankhorage/studio/dnd/primitives`, and `@ankhorage/studio/dnd/state` exports are also removed;
app-facing canvas code imports the maintained cross-platform adapter directly.

## Deliberately not moved here

This slice does not move product UI or app-host implementation code. In particular, this package
still does not own:

- `AnkhStudio`
- `StudioApp`
- Studio workspace route screens
- React Native components
- Expo-specific code
- generated-app runtime composition code
- DnD implementation
- Supabase or storage implementation
- template catalog content
- generic runtime renderer/action/binding behavior

## Dependency rule

The public contracts may depend on `@ankhorage/contracts` because those are shared
manifest/runtime schema types. They must not import React, React Native, Expo, DnD, Supabase,
generated-app runtime composition code, or host-app implementation modules.
