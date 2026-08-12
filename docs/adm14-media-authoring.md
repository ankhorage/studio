# ADM-14 media authoring architecture

Studio treats app-authoring media as a canonical manifest capability, not as a special Image upload field.

## Three distinct media domains

### Bundled app assets

Bundled assets ship with the generated app and are addressed by `MediaBundledSource.path`. The persisted path is a logical app-relative path. React Native `require()` handles and other platform-specific render values are runtime concerns and are never serialized into the manifest.

### App-authoring media

`AppManifest.media.assets` is the canonical app-authoring media pool. Component properties reference entries only through `{ mediaId }`. Entries may point at a bundled source, a provider-neutral storage identity, or a stable HTTP(S) URL.

Studio may show storage-backed and bundled media in the same authoring pool because they share one manifest-level identity model. Storage provider details remain behind owning adapters and trusted host services.

### Runtime user uploads

Avatars, posts, attachments and other user-generated runtime data do not belong in `AppManifest.media`. They remain application data governed by runtime authentication, authorization and storage policy. Runtime uploads may physically use the same provider as authoring media, but must remain logically separated by bucket, prefix and policy.

## `infra.storage`

Generated `infra.storage` describes application storage infrastructure and provider selection. It is not itself a Studio media registry and it does not imply that every storage object is an app-authoring asset. Studio-managed media may use storage created or selected through that infrastructure, but only explicit entries in `manifest.media.assets` belong to the authoring pool.

## Stable persistence model

The only component-property reference persisted by Studio is:

```text
{ mediaId }
```

The referenced `MediaAsset` owns source identity and metadata. Studio must never persist browser object URLs, local picker URLs, `blob:`, `file:`, `content:`, `data:` values, provider service-role secrets or platform-specific render handles.

External URL import in the current slice remains remote. Studio accepts only stable HTTP(S) URLs without embedded URL credentials. Remote ingestion into managed storage is a trusted media-service concern rather than a client-side shortcut.

## Web, iOS and Android selection

All platforms converge on the same persistence model. Web file input, native document/photo pickers and future capture flows may return temporary local values for preview or upload, but those values must be consumed by a trusted upload/import flow before the manifest changes. The final mutation is always a canonical media-pool entry plus `{ mediaId }` property reference.

## Current Studio slice

The first Studio implementation provides:

- `/ankh/media` as the manifest-backed authoring pool;
- browsing of bundled, storage-backed and URL media already present in the manifest;
- stable external HTTP(S) URL import;
- media metadata display where available;
- recursive component-property usage detection;
- deletion only when an asset is unused;
- generic Properties selection driven by ZORA `type: 'media'` and `mediaKinds` metadata.

The next slice adds trusted upload/import operations and platform source selection without changing the canonical manifest model.
