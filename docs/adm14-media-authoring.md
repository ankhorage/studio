# ADM-14 media authoring architecture

Studio treats app-authoring media as a canonical manifest capability, not as a special Image upload field.

## Three distinct media domains

### Bundled app assets

Bundled assets ship with the generated app and are addressed by `MediaBundledSource.path`. The persisted path is a logical app-relative path. React Native `require()` handles and other platform-specific render values are runtime concerns and are never serialized into the manifest.

Studio-owned bundled files live below `assets/authoring/<mediaId>/...`. The trusted host writes normalized picker bytes only inside that project-local authoring directory and then regenerates the Expo/Metro asset registry.

### App-authoring media

`AppManifest.media.assets` is the canonical app-authoring media pool. Component properties reference entries only through `{ mediaId }`. Entries may point at a bundled source, a provider-neutral storage identity, or a stable HTTP(S) URL.

Studio may show storage-backed and bundled media in the same authoring pool because they share one manifest-level identity model. Storage provider details remain behind owning adapters and trusted host services.

### Runtime user uploads

Avatars, posts, attachments and other user-generated runtime data do not belong in `AppManifest.media`. They remain application data governed by runtime authentication, authorization and storage policy. Runtime uploads may physically use the same provider as authoring media, but must remain logically separated by bucket, prefix and policy.

## `infra.storage`

Generated `infra.storage` describes application storage infrastructure and provider selection. It is not itself a Studio media registry and it does not imply that every storage object is an app-authoring asset. Studio-managed media may use storage created or selected through that infrastructure, but only explicit entries in `manifest.media.assets` belong to the authoring pool.

Bundled authoring media does not use `infra.storage`. It becomes part of the generated application bundle under `/assets` and is represented only by its canonical app-relative bundled path.

## Stable persistence model

The only component-property reference persisted by Studio is:

```text
{ mediaId }
```

The referenced `MediaAsset` owns source identity and metadata. Studio must never persist browser object URLs, local picker URLs, `blob:`, `file:`, `content:`, `data:` values, provider service-role secrets or platform-specific render handles.

External URL import remains remote. Studio accepts only stable HTTP(S) URLs without embedded URL credentials. Remote ingestion into managed storage is a trusted media-service concern rather than a client-side shortcut.

For bundled ingestion, the manifest receives only a canonical source such as `{ kind: 'bundled', path: 'assets/authoring/hero/hero.png' }`. Metro `require()` values remain generated runtime data and never become manifest identity.

## Web, iOS and Android selection

All platforms converge on the same persistence model. Web file input and native document/photo pickers may return temporary local values for preview or ingestion, but those values are consumed before the manifest changes.

The same normalized picker bytes can target either managed `storage` or `bundled` authoring media. The picker contract therefore remains target-neutral. The final mutation is always a canonical media-pool entry plus a `{ mediaId }` component-property reference.

## Expo runtime bridge

`syncGeneratedAppFiles()` scans `assets/authoring` and generates `src/generated/bundledMediaRegistry.ts`. Expo Runtime 2.2.1 owns the static Metro registry format and the canonical bundled-media resolver through the lightweight `@ankhorage/expo-runtime/bundled-media` subpath.

The generated registry maps canonical bundled paths to literal Metro `require()` expressions. Generated apps consume that registry even when Studio is not included. Studio preview consumes the same registry and composes its bundled resolver with the trusted host-backed storage resolver, so bundled, storage-backed and stable URL assets coexist behind the same Runtime media contract.

## Studio coverage after this slice

Studio now provides:

- `/ankh/media` as the manifest-backed authoring pool;
- browsing of bundled, storage-backed and stable URL media;
- stable external HTTP(S) URL import;
- web/iOS/Android picker ingestion through the platform-neutral picker contract;
- managed-storage ingestion through the trusted host and provider-neutral storage adapter;
- bundled ingestion into `assets/authoring/<mediaId>/...` from the same normalized picker bytes;
- generated static Metro registries for bundled authoring assets;
- bundled resolution in generated apps, including apps without Studio;
- Studio preview composition of bundled and storage-backed media resolution;
- media metadata display where available;
- recursive component-property usage detection;
- usage-safe manifest-first deletion with managed/bundled physical cleanup;
- generic Properties selection driven by ZORA `type: 'media'` and `mediaKinds` metadata.

## Lifecycle boundary

Media deletion is usage-aware and manifest-first. Studio removes the unused asset from the canonical manifest and flushes that manifest successfully before the trusted host may touch a physical source. A failed manifest save rolls the local mutation back and leaves the source untouched.

After a successful manifest save, managed storage sources are removed through the provider-neutral `MediaStorageAdapter.remove()` boundary and bundled sources are removed only below `assets/authoring` before the static Metro registry is regenerated. Stable external URL sources have no physical cleanup operation.

If post-save physical cleanup fails, Studio keeps the manifest safely reference-free and reports that an orphaned authoring source may remain. It never restores a manifest reference to a source whose cleanup outcome is uncertain.
