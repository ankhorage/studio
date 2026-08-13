# ADM-14 media authoring architecture

Studio treats app-authoring media as one canonical manifest capability rather than an Image-specific upload field.

## Media domains

Bundled app assets ship with the generated app. Studio-owned bundled files live below `assets/authoring/<mediaId>/...` and are persisted as logical `MediaBundledSource.path` values. Platform render handles are never serialized.

Managed authoring media lives in `AppManifest.media.assets` and may use provider-neutral storage or stable HTTP(S) URL sources. Component properties persist only `{ mediaId }` references.

Runtime/user-generated uploads such as avatars and posts are application data, not Studio authoring media. They remain governed by runtime auth and storage policy even when they share physical infrastructure.

## Storage and bundle targets

`infra.storage` describes application storage infrastructure. It is used for managed authoring media but not for bundled media. Bundled authoring assets become part of the generated app bundle under `/assets`.

The same normalized web/iOS/Android picker bytes can target either `storage` or `bundled`. The picker contract and media reference model therefore stay target-neutral.

## Expo runtime bridge

`syncGeneratedAppFiles()` scans `assets/authoring` and generates `src/generated/bundledMediaRegistry.ts`. Expo Runtime 2.2.1 exposes the static Metro registry generator and canonical bundled-media resolver through `@ankhorage/expo-runtime/bundled-media`. Generated apps and Studio preview consume that same owner boundary.

Studio preview composes bundled resolution with the existing trusted storage resolver, so bundled, storage-backed and URL assets coexist in the same media pool.

## Lifecycle

Manifest removal remains usage-aware. Physical cleanup of bundled files and managed storage objects is intentionally a separate trusted lifecycle operation and is not silently coupled to manifest mutation in this slice.
