# ADM-14 trusted media ingestion

Studio authoring media crosses explicit platform and trusted-host boundaries before it enters the manifest.

1. A platform picker returns transient bytes and metadata. Expo implements this through `@ankhorage/expo-runtime/media-picker`; Studio depends only on a structural picker contract.
2. The Studio UI sends those normalized bytes to the local trusted host with an explicit authoring target: managed `storage` or `bundled` app media.
3. The trusted host owns the target-specific side effect and returns a canonical `MediaAsset`; only then does Studio mutate `AppManifest.media.assets`.

## Managed storage target

For managed storage, the host resolves the project's configured storage provider and uploads through the provider-neutral `MediaStorageAdapter` contract. The manifest receives only a canonical storage source (`storageId?`, `bucket`, `path`).

The trusted host resolves `infra.storage.provider = auto` to Supabase when the project's auth or database provider is Supabase, matching the existing local-infrastructure behavior. S3 and R2 remain unsupported by the current local infrastructure adapter and fail explicitly instead of silently falling back.

Storage-backed preview URLs are transient. `AnkhStudio` supplies Runtime with the manifest media registry and a host-backed media resolver; Runtime receives resolved URLs only for rendering and never writes signed or public provider URLs back into the manifest.

## Bundled target

For bundled authoring media, the same normalized picker bytes bypass `infra.storage`. The trusted host writes the file only below `assets/authoring/<mediaId>/...` in the generated project and persists a canonical source such as `{ kind: 'bundled', path: 'assets/authoring/hero/hero.png' }`.

After a bundled write, `syncGeneratedAppFiles()` regenerates `src/generated/bundledMediaRegistry.ts`. `@ankhorage/expo-runtime/bundled-media` owns the static Metro registry source format and bundled resolver without requiring the Expo Runtime root UI/provider barrel. Generated production apps consume this registry directly, including apps that do not include Studio.

Studio preview receives the same bundled registry and composes its bundled resolver with the existing trusted storage resolver. Both targets therefore converge behind the canonical Runtime media contract rather than introducing target-specific component values.

## Persistence and trust boundary

Picker `file:`, `content:`, `blob:`, and `data:` locations are transient ingestion inputs only. Supabase credentials, provider service-role secrets, signed URLs, public provider URLs and Metro `require()` handles are never persisted as media identity.

Stable external HTTP(S) URL import remains a third canonical source form. Copying a remote URL into managed storage is a trusted media-service concern rather than a low-level provider or client-side shortcut.

Runtime/user-generated uploads remain a separate logical pool. Managed app-authoring media uses the authoring storage namespace, while bundled authoring media ships with the generated app. Neither path turns runtime application uploads into Studio manifest assets.

Physical cleanup of bundled files or managed storage objects remains separate from manifest removal so deletion failures and reference safety stay explicit.
