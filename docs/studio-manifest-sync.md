# Studio manifest sync helpers

`@ankhorage/manifestSync` owns package-neutral manifest signature helpers used by Studio hosts to decide whether draft manifests or generated runtime output need persistence.

## Import

```ts
import {
  createStudioManifestSignature,
  createStudioRuntimeSyncSignature,
} from '@ankhorage/manifestSync';
```

## Owned here

- Full Studio manifest signatures for draft persistence equality.
- Runtime-sync signatures for runtime-relevant manifest fields.
- Stable module ordering before runtime signature creation.
- Screen metadata-only runtime signatures, so authoring-only root changes do not force runtime sync.

## Host-owned inputs and effects

Hosts still own:

- fetch calls to a bridge or backend
- autosave timers and save status
- project URL construction
- React provider lifecycle
- translation reload side effects
- DnD/dialog/gesture providers

## Runtime signature scope

`createStudioRuntimeSyncSignature` includes:

- navigator
- sorted screen metadata (`id`, `name`, `title`)
- app data, data bindings, and data sources
- auth flow and auth config
- sorted module names

It intentionally does not include the full screen root tree. Studio draft persistence should use `createStudioManifestSignature` when full authoring state equality matters.
