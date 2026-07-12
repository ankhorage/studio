# @ankhorage/studio

## 0.6.0

### Minor Changes

- 3708a66: Generate the canonical cross-platform OAuth PKCE runtime for Supabase auth, including enabled-provider configuration, Expo browser/deep-link transport, one callback route, unified provider controls, and SecureStore-backed native session persistence.

## 0.5.1

### Patch Changes

- 5b44e42: devtools sync (update CI pipeline)

## 0.5.0

### Minor Changes

- fe5263a: Complete Phase 2 auth and secret administration with URL-backed admin routes, auth health metadata, schema-aware secret usage detection, and guarded secret deletion.

## 0.4.0

### Minor Changes

- 7c1b230: Add canonical authentication settings validation, host APIs, and Studio controls for auth methods, routes, OAuth activation, provider state, and profile configuration.

## 0.3.0

### Minor Changes

- bf89543: Add metadata-only authentication and project-secret administration screens backed by the canonical server-side secret bridge.

## 0.2.0

### Minor Changes

- fa50959: Add the canonical server-only Supabase Vault secret boundary, metadata-only project secret APIs, safe OAuth credential/manifest orchestration, and the `/ankh/secrets` admin route foundation.

## 0.1.6

### Patch Changes

- 8a18002: Read and generate authentication routes only from `infra.auth.flow`, use the contracts resolver for defaults, and prevent `settings.authFlow` from returning.

## 0.1.5

### Patch Changes

- 7d7d517: Initialize generated Studio development layouts with the runtime manifest so auth routes can mount and redirect.

## 0.1.4

### Patch Changes

- 6ffa28e: Include generated apps in workspace installs and export the Studio runtime symbols consumed by generated layouts.

## 0.1.3

### Patch Changes

- 57493ab: Declare generated runtime registries before composing the generated app component registry.

## 0.1.2

### Patch Changes

- 2ea1c50: Make the executable Studio app own the SDK-compatible native modules reachable through Zora, align SDK 54 autolinking resolution, and validate the real Expo web bundle in CI.

## 0.1.1

### Patch Changes

- ad74ce0: Emit the root and host package entrypoints, build the parent Studio package before running the nested Expo app, and validate the local app consumer in CI.

## 0.1.0

### Minor Changes

- 7e12f29: Own the complete local Studio host lifecycle, expose the host API, run the dashboard and loopback host together, and make Studio CLI project operations call the shared project, manifest, module, infrastructure, and workspace services directly.

## 0.0.21

### Patch Changes

- 660a0b0: Expose the generated-app runtime overlay from the Studio runtime surface.

## 0.0.20

### Patch Changes

- 04032ba: Expose Studio app exports from the package root.

## 0.0.19

### Patch Changes

- d504af9: Add package command metadata.

## 0.0.18

### Patch Changes

- 0a33213: Add Studio-owned DnD and preview runtime composition surfaces with direct owner-package imports.

## 0.0.17

### Patch Changes

- 3bf0e6d: Expose the remaining Studio product internals under first-class `@ankhorage/studio` package paths.

## 0.0.16

### Patch Changes

- 4361be0: Add the Studio product app workspace and public app entry surface.

## 0.0.15

### Patch Changes

- 570117d: Consume shared runtime node-props resolver contracts from `@ankhorage/contracts/runtime` in runtime localization helpers.

## 0.0.14

### Patch Changes

- 8f3100e: Add consolidated package-neutral Studio model helpers for diagnostics display data, admin route state, selection state, and localization panel behavior.

## 0.0.13

### Patch Changes

- b9c27b8: Add `@ankhorage/studio/runtimeLocalization` for package-neutral Studio runtime localization helpers.

## 0.0.12

### Patch Changes

- 85c9d97: Add `@ankhorage/studio/canvasDragModel` for package-neutral Studio canvas movement payload and placement slot helpers.

## 0.0.11

### Patch Changes

- be06ee0: Add `@ankhorage/studio/insertModalModel` for package-neutral Studio insert modal model helpers.

## 0.0.10

### Patch Changes

- ec30070: Add `@ankhorage/studio/localizationConfig` for package-neutral Studio localization config parsing helpers.

## 0.0.9

### Patch Changes

- b11234d: Add `@ankhorage/studio/manifestNavigatorPreviewModel` for package-neutral manifest navigation preview modeling.

## 0.0.8

### Patch Changes

- f40f293: Add `@ankhorage/studio/canvasDropZones` for package-neutral Studio canvas drop-zone resolution helpers.

## 0.0.7

### Patch Changes

- 7cb7b38: Add `@ankhorage/studio/routeUtils` as a package-neutral route-tree helper subpath, including leaf-route reordering within a selected parent path.

## 0.0.6

### Patch Changes

- a2f69dd: Move package-neutral Studio manifest persistence and runtime-sync signature helpers into the standalone Studio package under `@ankhorage/studio/manifestSync`.

## 0.0.5

### Patch Changes

- 0575e2e: Move package-neutral Studio manifest state helpers into the standalone Studio package, including manifest fingerprinting, route tree helpers, node/screen/theme/data/module/OAuth mutations, and a manifest-state package subpath.

## 0.0.4

### Patch Changes

- 930fafe: Move package-neutral Studio authoring model helpers into the standalone Studio package, including action definitions, component metadata contracts, empty screen template, tree helpers, placement resolution, and insert catalog helpers.

## 0.0.3

### Patch Changes

- 3808620: Add the first package-neutral Studio authoring contracts for manifest editing, selection state,
  node placement, insert catalog entries, and Studio command/event boundaries.

## 0.0.2

### Patch Changes

- 05eb9c6: Bootstrap the standalone Studio package scaffold.
- a17af9f: Release trigger
