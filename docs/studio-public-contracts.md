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
- generic module lifecycle/admin contribution view contracts

`StudioContextValue` now carries the caller-injected `componentMeta` registry and concrete
`insertFromCatalogEntry`, `moveNodeToPlacement`, and `deleteNode` capabilities. `StudioProvider`
requires that registry so the generated Studio app uses the same component rules as its Runtime.
`resolveMoveNodePlacement` is public for validating and normalizing a placement before mutation;
`invalid-reference` identifies incoherent sibling references.

The context exposes parent-scoped `moveRoute` and
`setRoutePrimaryNavigationVisibility` capabilities backed by the package-neutral manifest model.
The broad `reorderScreens` context method and the duplicate public route reorder helpers were
removed so Studio and generated apps edit one canonical nested navigation tree.

The obsolete `addNodeToTree`, `moveNodeInTree`, directional `moveStudioManifestNode`, and
`StudioContextValue.moveNode` APIs have been removed. The `@ankhorage/studio/dnd`,
`@ankhorage/studio/dnd/primitives`, and `@ankhorage/studio/dnd/state` exports are also removed;
app-facing canvas code imports the maintained cross-platform adapter directly.

The obsolete `@ankhorage/studio/manifestNavigatorPreviewModel`,
`@ankhorage/studio/runtime/previewRegistry`, and
`@ankhorage/studio/runtime/previewRuntimeConfig` exports are removed as well. Generated apps use
their canonical manifest navigator and Runtime registry in both Edit and Preview; Studio contributes
only mode policy and its declared app extensions.

ADM 10 also removes the Studio-owned localization config, localization panel, and localization
runtime helper subpaths. Those were module-specific domain surfaces. Generic module administration
now consumes optional package-owned contributions and persists only through the Orchestrator
lifecycle; it does not expose a parallel Studio module configuration API.

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
