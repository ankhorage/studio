# Studio runtime localization

`@ankhorage/studio/runtimeLocalization` provides package-neutral helpers for applying Studio localization behavior to runtime-rendered nodes.

## Import

```ts
import {
  createStudioLocalizationActionHandlers,
  createStudioLocalizationNodePropsResolver,
} from '@ankhorage/studio/runtimeLocalization';
```

## Owned here

- localized prop-key to runtime prop mapping
- localized prop fallback behavior
- runtime node prop resolver for localized props
- `setLanguage` action payload parsing
- runtime action handler for changing active locale

## Host-owned concerns

Hosts still own active locale state, dictionary fetching, translation lookup implementation, runtime config composition, and rendering lifecycle.
