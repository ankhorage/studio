# Studio manifest state model

This package exposes a package-neutral manifest state model through `@ankhorage/studio/manifestState`.

## Owned here

The manifest state model owns reusable operations that edit or inspect Studio manifests without React, React Native, Expo Router, DnD, Supabase, storage, or concrete Zora implementation modules:

- manifest fingerprinting for host sync checks
- recursive initial-screen, active-screen, and root-node resolution
- safe selected-node resolution
- a complete screen/navigation model with nested route references, canonical pathname patterns,
  primary navigator membership, visibility, initial-route state, sibling order, and diagnostics
- node update, delete, insert, move, and reorder mutations
- atomic screen creation/deletion and parent-scoped route movement
- navigator type, initial route, and primary-navigation visibility mutations
- app data, data binding, and data source mutations
- theme mutations
- module config and OAuth provider mutations

## Host-owned inputs

Host packages still own lifecycle and concrete integration inputs:

- React hook state and effects
- active selection events
- concrete component metadata registries such as Zora
- UI panels, admin screens, preview components, DnD runtime, and storage/runtime integrations

Where a mutation needs component placement rules, callers pass `StudioComponentMetaRegistry` instead of this package importing Zora.

Insert and move wrappers delegate to the same canonical tree placement functions exported from the
root authoring model. `resolveMoveNodePlacement` validates the requested parent, reference, index,
component compatibility, root/self/descendant safety, and same-parent index adjustment before a
move is applied. This keeps Insert UI and canvas DnD on one `NodePlacement` contract rather than
directional or gesture-specific mutation APIs.

Deleting a node removes the full subtree. Data and event bindings keyed by, or owned by, any node
in that subtree are removed in the same immutable manifest mutation.

`deriveStudioScreenNavigationModel` is the single authoring projection over `screens` and the
canonical nested navigator tree. It includes unrouted screens and reports missing screen
references, ambiguous screen references, duplicate sibling route names, invalid initial routes,
empty navigators, malformed route targets, mismatched screen registry keys, and duplicate stable
screen IDs without flattening the manifest. Studio's canonical manifest invariant requires every
`screens` registry key to equal that screen's unique `ScreenSpec.id`; the Studio manifest guard
rejects inputs that violate it. The package-neutral projection still diagnoses malformed typed
inputs deterministically, exposes only `ScreenSpec.id` as Studio identity, and resolves route
references internally through their canonical registry keys. Screen-specific reads and mutations
reject a malformed registry instead of selecting a screen by either identity accidentally.

`resolveStudioScreenAppPath` returns a pathname only when one parameter-free, globally unambiguous
canonical route reference resolves to a screen. It returns `null` for unrouted, multiply
referenced, colliding, or dynamic route patterns so admin UI cannot silently choose a route or
invent missing route parameters.

Screen creation targets the primary app navigator (`(app)`, then `app`, then the root) unless an
explicit valid parent path is supplied. Screen deletion removes every route reference and every
binding owned by the deleted screen subtree, normalizes affected initial routes, and selects a
deterministic survivor. Invalid mutations preserve the original manifest instance.

Route order changes use `moveStudioManifestRoute` with a parent path, route name, and target sibling
index. Visibility changes use `setStudioManifestRoutePrimaryNavigationVisibility`; visible routes
use the contract default (the field is omitted) and hidden routes retain their route with
`showInPrimaryNavigation: false`.

## Import path

Use the manifest-state subpath when consuming these helpers:

```ts
import {
  addStudioManifestScreen,
  deriveStudioScreenNavigationModel,
  hasCanonicalStudioScreenRegistryIdentity,
  moveStudioManifestRoute,
  resolveInitialScreenId,
  resolveStudioScreenAppPath,
  updateStudioManifestNode,
} from '@ankhorage/studio/manifestState';
```

The root package remains the public contracts and authoring model entrypoint. The manifest-state
subpath keeps route and authoring decisions reusable by Studio and generated app hosts without
coupling the model to a React lifecycle or platform router.
