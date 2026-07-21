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
