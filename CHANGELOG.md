# @ankhorage/studio

## 2.0.2

### Patch Changes

- 87906b9: Add permanent Expo 57 generated capability acceptance over pristine generated output, consume the
  shared Expo Runtime media picker with PNG/JPEG and operational-error enforcement for deploy assets,
  correlate exact OAuth callback replays through the auth owner, and update generated Studio fixtures
  to the released 2.0.1 boundary.

## 2.0.1

### Patch Changes

- e4498a8: Generate Stack, JavaScript Tabs, and Drawer navigation through Expo Router 57-owned public APIs, remove obsolete direct React Navigation dependencies, and add permanent typed-route and browser/static navigation acceptance.

## 2.0.0

### Major Changes

- 1c23f86: Rebuild generated app scaffolds on the released Expo 57 platform contract and Expo defaults, using
  the focused Expo Runtime action bridge so camera-free apps do not install camera permissions.

## 1.13.5

### Patch Changes

- 85ce343: Prepare generated Android development builds for loopback-only local services by resolving the default Studio API through device loopback, checking Studio Host availability before Expo starts, and supervising verified Studio API and Supabase reverse mappings on every replacement transport for Expo's selected device.
- 85ce343: Resolve React Native animation singletons from each consuming Expo app root and require hosts to provide Gesture Handler as a peer.
- 85ce343: Refresh generated Ankhorage package versions, keep the Expo Doctor cleanup that removes the redundant direct `expo-modules-core` dependency, and restore the Android-validated pre-1.13.4 animation stack: Reanimated `4.3.0`, Worklets `0.8.3`, and the explicit `react-native-worklets/plugin` Babel wiring.
- 85ce343: Require `@ankhorage/infra` 4.1.1 and keep Studio's runtime recovery boundary topology-agnostic so generated Minikube forwards derive from configured deploy targets and survive profile restarts without targeting absent services.
- 85ce343: Keep generated standalone Android apps independent from the Studio Host by omitting the implicit Studio API health check and reverse mapping when `includeStudio` is disabled, while retaining the ZORA runtime peers required by standalone apps.

## 1.13.4

### Patch Changes

- 66f5339: Align generated apps and the first-party Studio Expo app with the Expo SDK 54 package baseline, including Reanimated `~4.1.1`, Worklets `0.5.1`, Expo `~54.0.37`, Expo Constants `~18.0.14`, and Expo Updates `~29.0.20`. Remove the custom animation compatibility shim and explicit Worklets/Reanimated Babel plugin wiring so Expo's Babel preset owns the supported setup.

## 1.13.3

### Patch Changes

- 73b06b9: Generate Studio app headers and Zora providers against their current contracts, removing stale AppBar props and redundant theme synchronization from generated apps.

## 1.13.2

### Patch Changes

- 630697a: Make the standalone Studio development host reachable from same-LAN iOS and Android clients while keeping web localhost access, and render embedded Studio load errors with native-safe text.

## 1.13.1

### Patch Changes

- 6259a3d: Use the released headless `@ankhorage/runtime/bindings` entrypoint for the generated Nutrition API acceptance path and require Runtime 2.1 or newer.

## 1.13.0

### Minor Changes

- 442aeff: Adopt canonical API authoring and runtime bindings through `manifest.infra.apis[]` and `apiId`, removing the legacy generated API and API-flavoured data-source compatibility paths for Phase 1.

## 1.12.7

### Patch Changes

- c3ab782: Refresh generated app dependency baselines to current Ankhorage package releases and current Expo SDK 54 patch versions, and replace floating `latest` dependencies with explicit compatible ranges.

## 1.12.6

### Patch Changes

- 20acea9: Use ZORA's canonical responsive contract and bounded SidebarLayout fill sizing in the Studio admin shell.

## 1.12.5

### Patch Changes

- 8bef0ce: Keep Deploy runtime logic in the trusted Studio host so generated React Native clients do not bundle Node-only `@ankhorage/deploy` modules.

## 1.12.4

### Patch Changes

- b38530b: Keep generated screen routes layout-transparent so authored ZORA screens own page scrolling and delegated viewport content receives bounded flex space.

## 1.12.3

### Patch Changes

- 1ed5d42: Preserve the Auth 5 native OAuth smoke project's own Supabase gateway URL and anon key after Infra Up instead of substituting runtime values from the credential source project.

## 1.12.2

### Patch Changes

- d45312e: Activate the Auth 5 native OAuth smoke against the smoke project's own Infra redirect configuration while reusing trusted provider credentials only through the Studio host.

## 1.12.1

### Patch Changes

- 360e326: Complete generated native OAuth callbacks from Expo Router search parameters so warm deep links reach PKCE session exchange reliably, and remove obsolete OAuth transport compatibility state.

## 1.12.0

### Minor Changes

- 1fc1789: Complete `/ankh/deploy` administration with Deploy-owner-backed store listing and asset authoring, monetization and prepared-release mutations, canonical monetization inspect/plan/execute synchronization, immutable history detail, concurrent provider-mutation guards, and direct generated-app route/reload acceptance coverage. Raw deployment secrets remain server-only and Studio continues to define no parallel deployment semantics or persistence.

## 1.11.0

### Minor Changes

- 61d175e: Add canonical Deploy plan preview, explicit execution confirmation, exact-plan execution, resume, lifecycle controls, and owner-result rendering to `/ankh/deploy`. Execution IDs remain trusted-host generated, raw credentials stay server-only, and Studio preserves Deploy's drift, blocked, waiting, failure, verification, and history-recording semantics.

## 1.10.1

### Patch Changes

- ac33da2: Preserve Studio administration routes across generated-app runtime syncs by persisting explicit
  project generation state instead of inferring Studio inclusion from generated source structure.

## 1.10.0

### Minor Changes

- 9097d8c: Add the canonical `/ankh/deploy` administration route with a read-only Deploy-owned target, authored-state, history, and provider-readiness dashboard. Provider readiness uses the trusted Studio Deploy host and never exposes raw credential material or executes deployment mutations.

## 1.9.1

### Patch Changes

- 884956a: Add a reproducible Google brokered-OAuth development-build smoke fixture and manual iOS/Android validation matrix for Auth 5.

## 1.9.0

### Minor Changes

- 979ce37: Consume released `@ankhorage/deploy` owner APIs through a shared trusted Studio host service, server-only Vault credential adaptation, and thin browser-safe deployment administration routes.

## 1.8.0

### Minor Changes

- 6cee05f: Reject unsupported Expo Go native OAuth hosts before the generated auth adapter creates authorization or PKCE state.

## 1.7.0

### Minor Changes

- 4854095: Route native Expo authentication browser outcomes through the Expo Runtime transport classifier before adapter completion.

## 1.6.0

### Minor Changes

- f4079c4: Generate native brokered OAuth callbacks from canonical Expo target schemes.

## 1.5.0

### Minor Changes

- 09cfbfa: Consume platform- and environment-aware OAuth setup requirements in Studio auth administration and health.

## 1.4.0

### Minor Changes

- e1d5727: Consume canonical app deployment targets when generating Expo platform configuration and scripts, persist stable native identities for new projects, and stop deriving native identity during regeneration.

## 1.3.0

### Minor Changes

- c973abc: Complete the ADM-14 media lifecycle with persisted manifest-first cleanup for managed and bundled authoring sources.

## 1.2.0

### Minor Changes

- 06294ee: Add bundled app media authoring backed by assets/authoring and generated Expo media registries.

## 1.1.0

### Minor Changes

- 48fe300: Add trusted device and photo-library media ingestion, provider-neutral storage-backed authoring assets, and transient preview resolution through the local Studio host.

## 1.0.0

### Major Changes

- 627fd1d: Add the canonical manifest-backed Studio media pool, safe media usage/removal helpers, stable URL import, and generic media property authoring driven by component metadata.

## 0.24.0

### Minor Changes

- 4b08a54: Rebuild canonical Theme administration with global token editing, shared runtime Light/Dark mode selection, and metadata-driven ZORA component and pattern recipe overrides while preserving inherited defaults and module ownership boundaries.

## 0.23.0

### Minor Changes

- 390fff7: Delegate project infrastructure generation, inspection, lifecycle execution, runtime environment access, and database URL resolution to the canonical `@ankhorage/infra/project` owner API, removing Studio's duplicate Infra core implementation.

## 0.22.1

### Patch Changes

- 8c405d0: Delegate canonical AppManifest structural validation to the parser owned by `@ankhorage/contracts` and remove Studio's duplicate manifest guard tree.

## 0.22.0

### Minor Changes

- dd624df: Make `ankh.config.json` the sole persisted authoring manifest, remove `.ankh/studio.manifest.json` draft persistence, and synchronize generated runtime output from the canonical project manifest.

## 0.21.0

### Minor Changes

- 9787130: Use one canonical ZORA light/dark runtime mode across Studio and generated app runtime state, and remove the obsolete parallel Studio mode authority while leaving all user-facing theme controls and app-chrome placement to normal app UI.

## 0.20.0

### Minor Changes

- e1e096d: Host package-owned module administration views through the canonical module detail route and opaque admin runtime transport, and consume the released Localization admin view without introducing Localization domain logic into Studio.

## 0.19.0

### Minor Changes

- 788f20f: Add a generic package-owned module administration runtime host with opaque operation dispatch and injected lifecycle and authoring context capabilities.

## 0.18.1

### Patch Changes

- 3b2faae: Use the canonical `@ankhorage/utility` validators in generated auth screens and declare the utility dependency for generated auth apps.

## 0.18.0

### Minor Changes

- a25c14b: Add canonical Orchestrator-backed module lifecycle and package-owned administration routes, migrate manifests to `modules`/`modulesConfig`, and remove obsolete Studio-owned localization module surfaces.

## 0.17.0

### Minor Changes

- 3527949: Restore the generated-app Preview mode through the Studio AppBar, suppress authoring affordances
  while Preview is active, and keep Runtime interaction, actions, and navigation on the canonical app
  tree. Remove the obsolete preview registry, preview Runtime config, and manifest navigator preview
  model subpaths.

## 0.16.0

### Minor Changes

- a5cc8de: Adopt Contracts 5 and Templates 5 primary-navigation visibility, add the canonical package-neutral screen/navigation model and safe mutations, wire Studio persistence to those mutations, remove obsolete broad route reorder APIs, and add first-class `/ankh/screens` overview and stable-ID `/ankh/screens/:screenId` detail administration.

## 0.15.0

### Minor Changes

- ef09b66: Restore contextual Insert and Delete authoring, add placement-backed canvas drag and drop through
  the cross-platform adapter with deterministic session cleanup, and remove obsolete DnD wrappers
  and directional tree mutation APIs.

## 0.14.0

### Minor Changes

- c8bd10e: Restore contextual component binding authoring with ZORA-owned bindable metadata, canonical manifest data bindings, uniform external/generated operation selection, schema-aware response paths, event payload input mapping, and binding diagnostics while keeping execution in Runtime.

## 0.13.0

### Minor Changes

- 8a495ff: Restore generated REST/CRUD API authoring on `/ankh/apis`, persist canonical generated desired state with its normalized data-source projection, migrate external API administration to the Contracts 4 taxonomy, and remove the obsolete `manifest.data.apis` authoring path.

  - Wire generated Runtime 1 CRUD operations to released Supabase DB adapters through canonical generated API adapter IDs.

## 0.12.0

### Minor Changes

- 7468819: Rebuild external API authoring with trusted OpenAPI discovery, GraphQL introspection, manual REST fallback, canonical manifest persistence, operation visibility, and credential-safe endpoint testing.

## 0.11.12

### Patch Changes

- 32277c1: Replace the raw Properties prop dump with a metadata-driven instance authoring model backed by the released ZORA authoring authority registry.

## 0.11.11

### Patch Changes

- e94690f: Consume the released self-healing Supabase OAuth lifecycle, reduce generated transport persistence to a correlation-only marker, and prove full-page callback completion, replay protection, session persistence, and provider-denial recovery across navigation boundaries.

## 0.11.10

### Patch Changes

- 9175162: Consume the released Infra Auth redirect and rollout contracts, then surface exact OAuth callback targets and safe Auth readiness diagnostics through the existing project Auth health capability.

## 0.11.9

### Patch Changes

- 61e82f8: Generate Web OAuth with a full-page PKCE redirect while preserving the native system-browser flow and making callback completion replay-safe.

## 0.11.8

### Patch Changes

- 657738e: Generate OAuth callback-path normalization without a nested escaped regular expression so generated apps remain valid TypeScript.

## 0.11.7

### Patch Changes

- ce03925: Apply saved authentication settings to the generated Studio runtime so newly enabled OAuth providers appear on the sign-in screen immediately.

## 0.11.6

### Patch Changes

- 0213548: Update Infra and Supabase Vault to include the Bun PostgreSQL configured-fields fix with a clean Studio-only root lockfile.

## 0.11.5

### Patch Changes

- 9641ba5: Update INFRA
- 6bb91e6: release trigger

## 0.11.4

### Patch Changes

- 96bf304: Keep Studio AppBar actions horizontal and render theme-aware selected Runtime node chrome on React Native Web with lazy active-node resize observation.

## 0.11.3

### Patch Changes

- a3cbebe: Preserve Studio Runtime selection on nested navigator screens by resolving active pathnames and initial-route chains recursively through the canonical manifest navigation tree.

## 0.11.2

### Patch Changes

- 67968b6: update INFRA

## 0.11.1

### Patch Changes

- cc24a58: update INFRA

## 0.11.0

### Minor Changes

- 455fb84: Add public interaction-policy and stationary-selection runtime helpers, require ZORA 2.9 in
  generated apps, support explicit extension policy declarations, and provide stale-safe
  pointer/touch selection with layout-neutral, momentum-safe root-owned unsupported-component
  overlays. Generate first-party Expo SDK 54 apps with the compatible Reanimated 4.3.0 and Worklets
  0.8.3 pair.

## 0.10.9

### Patch Changes

- c5664c2: Repair the generated Expo web smoke harness so generated Studio apps hydrate consistently in Chrome during validation.

## 0.10.8

### Patch Changes

- c6b687a: Keep generated auth root entries navigation-neutral so the root layout alone canonicalizes authenticated `/` launches without synthetic Back history or `initial=false` workarounds.

## 0.10.7

### Patch Changes

- 85fad68: Anchor generated non-root auth redirects so the configured initial screen remains the root of navigator history without an erroneous Back button.

## 0.10.6

### Patch Changes

- 577b668: Update INFRA

## 0.10.5

### Patch Changes

- adb13a6: Generate auth-enabled apps with a canonical root route and a pending authentication boundary so protected content cannot mount before session bootstrap completes.

## 0.10.4

### Patch Changes

- f701207: Keep Studio Runtime selection pressable across Web and Native without giving the outer selection wrapper semantic button markup that can nest around real application buttons.

## 0.10.3

### Patch Changes

- 1d57fd9: Generate auth-enabled apps with a pending auth navigation boundary so protected routes remain unmounted until authentication resolves.

## 0.10.2

### Patch Changes

- 3cc49da: Fix generated nested navigator layouts so theme-dependent screen option declarations are scoped after `useZoraTheme()`, preventing `theme is not defined` crashes during Expo static rendering and infrastructure startup.

## 0.10.1

### Patch Changes

- ce8c673: Centralize generated root-layout import composition so Auth and Studio features share one deduplicated import block and cannot emit duplicate React bindings.

## 0.10.0

### Minor Changes

- aa71605: Restore interactive Studio edit-mode selection with layout-neutral selection chrome and selection-aware AppBar actions. Add contextual Properties navigation, parent selection, explicit selection clearing, and canonical edit-mode action suppression while preserving the ZORA-owned component registry and headless Runtime boundary.

## 0.9.0

### Minor Changes

- 4be3589: Update generated-app runtime registry composition to source the base ZORA registry from `@ankhorage/zora` and compose app extensions through Runtime's generic registry helpers.

  Remove Studio's compatibility ownership of the base ZORA registry from `@ankhorage/studio/runtime`; Studio now exports only its own extension registry surface while Runtime remains the canonical owner of generic registry composition mechanics.

## 0.8.1

### Patch Changes

- eab6a51: Update RUNTIME (release trigger)

## 0.8.0

### Minor Changes

- e0011ac: Rebuild the Studio workspace dashboard around real project lifecycle routes, grouped template catalog data, canonical project category summaries, and shared project ID validation.

## 0.7.1

### Patch Changes

- d34474a: update ZORA

## 0.7.0

### Minor Changes

- 1a010a4: Build the first-class `/ankh` administration shell with canonical nested admin routes, route
  registry helpers, generated page content, responsive admin navigation, and package-owned admin
  composition exports for generated apps.

## 0.6.10

### Patch Changes

- Restore workspace settings

## 0.6.9

### Patch Changes

- 919131c: Align the Studio app with the expected Expo SDK 54 patch versions and restrict the root workspace to the first-party `apps/studio` app so locally generated projects are not treated as repository workspaces.

## 0.6.8

### Patch Changes

- 97600f8: Update INFRA to add app .env.local file required to connect to db

## 0.6.7

### Patch Changes

- 39e9fbf: Align Studio project lifecycle ownership with `@ankhorage/infra` 1.0.0 generated slug-scoped Minikube infra.

  Studio now delegates app-owned Minikube up/down/destroy/status and port-forward ownership to generated Infra scripts, injects trusted OAuth credentials into Infra Up as process environment only when the local trusted store is reachable, defers stopped-store bootstrap to generated Infra, and keeps deletion and shutdown cleanup aligned with generated lifecycle boundaries.

## 0.6.6

### Patch Changes

- 3210f5d: Update SUPABASE-AUTH

## 0.6.5

### Patch Changes

- 876566a: Document the Studio CLI from the canonical CLI entrypoint, add a combined `bun dev` workflow, and explain local Studio usage in generated documentation.

## 0.6.4

### Patch Changes

- 1b8be86: Update packages

## 0.6.3

### Patch Changes

- ac49c42: Release trigger

## 0.6.2

### Patch Changes

- 43ac613: Generate Supabase Auth adapters from Infra-provided Expo public environment values only.

## 0.6.1

### Patch Changes

- 373082f: Verify the released Google and Apple OAuth fixtures through the real generated-app host pipeline and consume the released Phase 3 package APIs directly.

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
