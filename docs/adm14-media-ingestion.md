# ADM-14 trusted media ingestion

Studio authoring media crosses explicit platform and trusted-host boundaries before it enters the manifest.

A platform picker returns normalized bytes and metadata. Expo implements this through `@ankhorage/expo-runtime/media-picker`; Studio depends only on the structural picker contract. Studio then sends those bytes to managed storage or the generated app bundle.

Managed storage resolves the project's configured provider through the provider-neutral storage adapter and persists only canonical storage identity. Bundled media is written only below `assets/authoring/<mediaId>/...` and persists only `{ kind: 'bundled', path }`.

`syncGeneratedAppFiles()` regenerates `src/generated/bundledMediaRegistry.ts`. `@ankhorage/expo-runtime/bundled-media` owns the static Metro registry format and bundled resolver without loading the Expo Runtime UI/provider barrel. Generated production apps use that resolver directly; Studio preview composes it with the trusted storage resolver.

Web and native picker-local locations are transient input only. Bundled media does not use `infra.storage`; it ships with the app. Runtime/user-generated uploads remain a separate logical pool governed by application runtime policy.

Physical cleanup of files or storage objects remains separate from manifest removal so deletion failures and reference safety stay explicit.
