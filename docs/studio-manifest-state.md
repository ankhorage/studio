# Studio manifest state model

This package now exposes a package-neutral manifest state model through `@ankhorage/studio/manifestState`.

## Owned here

The manifest state model owns reusable operations that edit or inspect Studio manifests without React, React Native, Expo Router, DnD, Supabase, storage, or concrete Zora implementation modules:

- manifest fingerprinting for host sync checks
- recursive initial-screen, active-screen, and root-node resolution
- safe selected-node resolution
- screen route tree helpers
- node update, delete, insert, move, and reorder mutations
- screen add, delete, and route reorder mutations
- navigator type and initial route mutations
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

## Import path

Use the manifest-state subpath when consuming these helpers:

```ts
import {
  addStudioManifestScreen,
  resolveInitialScreenId,
  updateStudioManifestNode,
} from '@ankhorage/studio/manifestState';
```

The root package remains the public contracts and authoring model entrypoint. The manifest-state
subpath keeps route and authoring decisions reusable by Studio and generated app hosts without
coupling the model to a React lifecycle or platform router.
