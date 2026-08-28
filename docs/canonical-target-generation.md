# Canonical target generation

Studio generation consumes `AppManifest.deploy.targets` as the application platform identity
source.

- ProjectCreate applies the current Web + Android + iOS product default, derives native identifiers
  once, and persists the complete choice into `deploy.targets`.
- ProjectSync requires `deploy.targets` and fails explicitly when that canonical state is missing or
  invalid.
- Regeneration reads Android package, iOS bundle identifier, and native schemes only from the
  persisted target model; slug changes do not rename native identities.
- Disabled targets do not emit their Expo platform section or package script.
- Native targets without a canonical scheme do not receive a Studio-generated scheme.

Infra owns redirect allowlist derivation from the same target model; Studio does not duplicate
redirect policy.
