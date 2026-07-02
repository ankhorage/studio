# @ankhorage/studio

Standalone Studio package for Ankhorage authoring surfaces.

This repository is the extraction target for the Studio code currently living in
`ankhorage4/packages/studio`.

## Ownership

@ankhorage/studio owns Studio authoring and product contracts. Later extraction slices may move
Studio-specific UI and Studio-specific commands here.

## Consumes

The Studio package may consume these packages when needed:

- `@ankhorage/runtime` for generic runtime rendering contracts.
- `@ankhorage/expo-runtime` for Expo-specific runtime plans, providers, and adapters.
- `@ankhorage/templates` for template catalog access.
- `@ankhorage/ankh` for command routing.

## Does not own

This package must not own:

- generic runtime renderer behavior;
- generic runtime actions or bindings;
- Expo package, native config, provider, or adapter planning;
- generated-app overlay code;
- template catalog content;
- root command bus behavior.

Those responsibilities belong to `@ankhorage/runtime`, `@ankhorage/expo-runtime`,
`@ankhorage/templates`, and `@ankhorage/ankh`.

## Current scope

This initial package bootstrap intentionally does not move product UI from `ankhorage4` yet. It
provides the standalone package skeleton, public boundary docs, and validation scripts for staged
extraction.

## Validation

```bash
bun install
bun run build
bun run lint
bun run format:check
bun run knip
bun run test
bun run typecheck
bun run docs
bun run changeset:status
```
