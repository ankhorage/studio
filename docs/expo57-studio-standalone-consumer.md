# Expo 57 Studio standalone consumer

Issue #313 removes the remaining repository-only assumptions from `apps/studio`. The application is
now an ordinary Expo 57 consumer of released Ankhorage packages: it owns its install and tooling
contract, uses Expo Router directly, and does not build or type against the parent Studio package.

## Entry and release audit

Implementation started from `origin/main` commit `a68b0582405a040459398d0fe67fa695a622b227`
after issue #312 closed on 2026-08-26. That commit is the merge result of release PR #331 and follows
the merge of PR #330 at `ebd20aa8b433d40007b4173a3a05694e4ab345a6`.

The public registry, rather than the stale version in the issue body, established this baseline:

| Package                    | Published and acceptance-locked version |
| -------------------------- | --------------------------------------- |
| `@ankhorage/studio`        | `2.0.7`                                 |
| `@ankhorage/expo-runtime`  | `3.0.5`                                 |
| `@ankhorage/devtools`      | `1.6.1`                                 |
| `@ankhorage/supabase-auth` | `1.2.6`                                 |

The pre-implementation audit also covered the repository instructions, public exports, package
tests, source documentation, changesets, workflows, app and root manifests, Bun lockfile, every
Studio route, generated auth/capability paths, host boundaries, the existing acceptance harnesses,
the installed SDK 57 declarations, published owner tarballs, and the current official Expo 57
template and examples. It confirmed that Babel, Metro, `index.js`, direct `@expo/vector-icons`,
manual Ionicons loading, Worklets plugin, Router alias, and deprecated Android bar workarounds were
already absent and must remain absent.

The mandatory skills affected the result as follows:

- `ankhorage-package-structure` kept reusable platform planning in Expo Runtime, app-only tooling in
  `apps/studio`, and prevented a new public Studio API or source compatibility path.
- `expo-upgrade` drove the SDK 57 package/config comparison, React Compiler check, New Architecture
  assumptions, and regression assertions for deleted SDK 54-era configuration.
- `expo-router` required direct `expo-router/entry`, generated typed-route declarations, real dynamic
  and search parameters, nested layouts, reload, and browser Back/Forward evidence.
- `expo-dev-client` required fresh app-specific Android and iOS development clients plus separate
  release-configuration compilation instead of treating JavaScript export or CNG as runtime proof.
- `expo-native-ui` focused the native review on Android edge-to-edge, system insets, iOS safe areas,
  overlays, drawers, and correctly rendered static icon fonts.
- `expo-project-structure` shaped only the fresh single-package fixture; it did not restructure the
  existing application.
- `expo-examples` and the official SDK 57 template justified retaining Expo defaults and adding only
  the config plugins demonstrated as necessary by the native icon-font failure.

## Consumer contract

`apps/studio` now declares Node 24, Bun 1.3.14, every imported runtime dependency, and every invoked
tool directly. Its `@ankhorage/studio` range is `^2.0.9`; Expo Runtime `^3.0.6` supplies the sole
`EXPO_PLATFORM` authority used by `platform:check`. Ordinary app scripts never invoke a parent build,
and TypeScript has no parent path or `dist/root.d.ts` alias.

Before TypeScript runs, the app-owned Expo CLI generates a non-empty
`.expo/types/router.d.ts`. The platform check rejects `latest`, `workspace:`, `file:`, `link:`, parent
script references, and root-dist aliases. The existing Expo-default Babel and Metro behavior remains
unchanged. React Compiler stays enabled through Expo config and its healthcheck passes without
`"use no memo"` exclusions.

The app uses static Web output, a stable native scheme and application identifiers, and only the
four scoped React Native Vector Icons config plugins needed to register their linked fonts on iOS.
No direct `@expo/vector-icons` package or manual font-loading code was introduced.

## Permanent acceptance topology

Run the complete consumer proof with:

```bash
bun run test:acceptance:expo57-studio-standalone
```

The harness copies only the committed app consumer files into a fresh directory outside the checkout.
That directory is both the package root and installation root; there is no wrapper package, Bun
workspace, sibling package, parent `node_modules`, or symlink. A separate temporary host fixture is
used only to serve the HTTP behavior exercised by the app and is not part of dependency-resolution
evidence.

The acceptance creates a registry lockfile, deletes `node_modules`, and performs a cold frozen
install. For Studio, Expo Runtime, and Devtools it derives the installed registry version, proves
that it satisfies the declared release range, matches the exact fresh lockfile resolution, and lives
inside the fixture's own `node_modules`. The final gate additionally scans the physical Bun graph,
requires exactly one React Native 0.86.3 installation, rejects incompatible RN peers from every
installed Ankhorage owner, and requires Studio 2.0.9, Expo Runtime 3.0.6, Runtime 2.2.1, Surface
3.0.1 and ZORA 3.0.1 as compatible range floors rather than exact permanent versions. It hashes the
lockfile before and after all checks. The earlier frozen SDK 57
resolution used during implementation contained Studio 2.0.7, Expo Runtime 3.0.5, Devtools 1.6.1,
Expo 57.0.16, Expo Router 57.0.16, Expo Dev Client 57.0.15, Expo Splash Screen 57.0.8, React Native
0.86.2, and TypeScript 6.0.3. The completed 2026-08-27 repetition instead resolved Studio 2.0.9,
Expo Runtime 3.0.6, Devtools 1.7.0, Expo 57.0.17, Expo Router 57.0.17, Expo Dev Client 57.0.16,
React Native 0.86.3 and TypeScript 6.0.3 from the registry.

The same run performs the platform assertion, Router type generation, TypeScript, lint, format,
`expo install --check`, Expo Doctor, React Compiler healthcheck, development Web navigation, static
Web export and hydration, Android and iOS JavaScript exports, and clean CNG. Browser console errors,
page exceptions, hydration failures, and runtime failures are hard failures. It exercises `/`,
`/create`, `/create/[category]`, `/create/[category]/[templateId]`, and `/projects/[projectId]`,
including real path/search parameters, nested layout behavior, direct URLs, reload, and Back/Forward.
CNG assertions cover scheme, application identifiers, edge-to-edge, iOS 16.4 deployment target,
static icon-font registration, and continued absence of obsolete bar config.

The CI job repeats this registry-only proof on Node 24 and Bun 1.3.14. Normal repository-workspace
validation remains separate and mandatory.

## Issue #313 native build and runtime evidence

The issue #313 app fixture was rebuilt from clean CNG output on macOS 26.6 with Xcode 26.6, Bun 1.3.14,
Temurin Java 17.0.10, and the local Android SDK/NDK selected by Expo. The local shell provided Node
26.7.0; the package engine, platform assertion, and CI job enforce the authoritative Node 24 line.

| Target              | Environment                                                                                                    | Evidence                                                                                                                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Android development | Pixel 8 Pro AVD, Android 14 / API 34 (`Pixel_8_Pro_API_34-ext11`); generated min SDK 24, compile/target SDK 36 | Clean `expo run:android` Debug compilation, install, fresh app-owned Metro connection and visible boot; status/navigation insets, drawer/screens and icons inspected; no fatal runtime log |
| Android release     | Same SDK/NDK toolchain and AVD target                                                                          | `expo run:android --variant release --no-bundler` native Release compilation                                                                                                               |
| iOS development     | iPhone 17 Pro simulator `1BC84E26-39FC-4CDF-B877-CA6F044277B8`, iOS 26.5                                       | Clean `expo run:ios` Debug compilation, install, fresh app-owned Metro connection and visible boot; Dynamic Island/status-area layout and icons inspected; no fatal/exception runtime log  |
| iOS release         | Same simulator/Xcode toolchain                                                                                 | `expo run:ios --configuration Release` succeeded with zero errors; the three reported warnings were upstream build warnings                                                                |

Two defects surfaced only under honest native execution and are now covered by the permanent contract:

1. The Android development client crashed because the app used Expo Router's splash integration but
   did not directly declare `expo-splash-screen`. Adding the SDK-authoritative direct dependency fixed
   the missing native class.
2. iOS initially rendered replacement glyphs because the scoped icon packages were linked but their
   fonts were not registered in `UIAppFonts`. The official package config plugins fixed registration;
   CNG assertions now protect the four required font entries.

This section records the earlier standalone-app run and is historical for the RN patch. Issue #314
repeated Android/iOS Development and Release builds, installation and launch with the final single
RN 0.86.3 owner graph; that result is recorded in `docs/expo57-native-capability-evidence.md`.

For a fresh local repetition, run `bun run prebuild` before the native commands and use a rebuilt
development client. Existing SDK 54, RN 0.86.2, or issue #312 clients are not valid final issue #314
evidence.

## Package boundary and convergence

This adds no published `@ankhorage/studio` API. The patch changeset records the permanent
released-package acceptance and host smoke behavior rather than claiming a new consumer-facing
contract. Host-only fixture orchestration remains under `src/host/`, while the app consumes released
Studio, Runtime, ZORA, adapter, module, route, action, and data contracts in the same way as an
ordinary generated Ankhorage app. Removing the parent build, source alias, phantom tooling, and
workspace install assumptions directly reduces the architectural distance between the two consumers
without adding a Studio-only compatibility layer.
