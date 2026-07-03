# Studio manifest navigator preview model

`@ankhorage/studio/manifestNavigatorPreviewModel` provides package-neutral helpers for building a navigation preview model from an app manifest.

## Import

```ts
import {
  buildManifestNavigatorPreviewModel,
  resolveLeafScreenIdForRoute,
} from '@ankhorage/studio/manifestNavigatorPreviewModel';
```

## Owned here

- choosing the primary navigator for preview
- filtering auth and hidden chrome routes
- resolving route labels and active route names
- resolving leaf screen ids through nested navigators
- producing defensive icon diagnostics
- building a package-neutral route map

## Host-owned concerns

Hosts still own rendering tabs/drawers/stacks, Zora component adaptation, React state, preview frames, gestures, and runtime bridge calls.
