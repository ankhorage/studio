# Studio public contracts

`@ankhorage/studio` owns the package-neutral product and authoring contracts that an Ankhorage app
host needs to integrate Studio.

## Owned here

- package boundary metadata;
- project, session, selection, mode, panel, route, and save-state contracts;
- manifest editing and node-placement contracts;
- insert-catalog entries and authoring commands/events;
- the type-only Studio context shape;
- generic module lifecycle and administration contribution views.

`StudioContextValue` carries the caller-injected `componentMeta` registry and the canonical
`insertFromCatalogEntry`, `moveNodeToPlacement`, and `deleteNode` capabilities. The first-party
Studio application therefore applies the same component rules as Runtime rendering.

Navigation authoring is parent-scoped. Hosts use `moveRoute` and
`setRoutePrimaryNavigationVisibility` against the canonical nested application navigator. Edit and
Preview both use that navigator, the generated Runtime registry, and the same app route topology.

Generic module administration consumes optional package-owned contributions and persists through
the Orchestrator lifecycle. Studio does not expose a parallel module configuration model.

## Deliberately not owned here

The public contract layer does not own:

- product UI, workspace screens, or React Native components;
- Expo and platform implementation;
- generated-app Runtime composition;
- drag-and-drop implementation;
- Supabase or storage implementation;
- template catalog content;
- generic Runtime rendering, actions, or binding execution.

## Dependency rule

Public contracts may depend on `@ankhorage/contracts` for shared manifest and Runtime schema types.
They must not import React, React Native, Expo, drag-and-drop, Supabase, generated-app Runtime
composition, or host-app implementation modules.
