# ADM-14 trusted media ingestion

Studio authoring media now crosses two explicit capability boundaries before it enters the manifest.

1. A platform picker returns transient bytes and metadata. Expo implements this through `@ankhorage/expo-runtime/media-picker`; Studio depends only on a structural picker contract.
2. The Studio UI sends those bytes to the local trusted host. The host resolves the project's configured storage provider and uploads through the provider-neutral `MediaStorageAdapter` contract.

The manifest receives only a canonical `MediaAsset` with a stable storage source (`storageId?`, `bucket`, `path`). Picker `file:`, `content:`, and `blob:` URIs, Supabase credentials, signed URLs, and public provider URLs are never persisted as media identity.

The trusted host currently resolves `infra.storage.provider = auto` to Supabase when the project's auth or database provider is Supabase, matching the existing local-infrastructure behavior. S3 and R2 remain unsupported by the current local infrastructure adapter and fail explicitly instead of silently falling back.

Storage-backed preview URLs are transient. `AnkhStudio` supplies Runtime with the manifest media registry and a host-backed media resolver; Runtime receives signed URLs only for rendering and never writes them back into the manifest.

Runtime/user-generated uploads remain a separate logical pool. This path exists only for app-authoring media under the `authoring/` storage prefix.
