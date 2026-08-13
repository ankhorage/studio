# Auth 4 canonical target generation

Studio generation consumes `AppManifest.deploy.targets` as the application platform identity source.

- New Studio projects preserve the historical Web + Android + iOS default by deriving identifiers once during project creation and persisting them into `deploy.targets`.
- Regeneration reads Android package, iOS bundle identifier, and native schemes only from the persisted target model; slug changes do not rename native identities.
- Disabled targets do not emit their Expo platform section or package script.
- Manifests predating `deploy.targets` use a migration-safe Web-only generation view and do not gain guessed native identities.
- Native targets without a canonical scheme do not receive a Studio-generated scheme.

Infra owns redirect allowlist derivation from the same target model; Studio does not duplicate redirect policy.
