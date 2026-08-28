# Expo 57 production execution

Issue `studio#314` owns the production-execution acceptance for generated Expo 57 apps. The app
remains the only Expo SDK, CLI, configuration, CNG, and native-build truth. Studio contributes the
generated app and acceptance orchestration; Infra owns the generated image-build implementation.

## Owner boundary

`ankhorage/infra#67` is implemented by Infra PR `#79` and published in
`@ankhorage/infra@4.1.3`. Its generated `build-app-image.sh` resolves
only this executable:

```text
<generated-app>/node_modules/.bin/expo
```

When that file is absent, the script exits before export or Docker execution and instructs the
operator to run `bun install --frozen-lockfile` in the generated app. It has no `bunx`, global CLI,
network-resolution, workspace, `file:`, `link:`, or source fallback. Studio does not duplicate this
logic in a second image builder.

Studio's acceptance runners now use the same explicit app-owned executable for Router type
generation, dependency checking, Web/Android/iOS export, clean prebuild, development Web, and native
evidence preparation. The internal resolver exists only to make acceptance reject a missing app
installation precisely; it is not a runtime or generator compatibility path.

## Permanent production gate

Run the opt-in end-to-end gate on Node 24 LTS with Docker, Minikube, kubectl, Chrome, Bun 1.3.14,
and the released Infra package installed from the registry:

```bash
bun run test:e2e:expo57-production-infra
```

The gate creates a real application through `ProjectManager`, removes the temporary generation
workspace wrapper, and makes the generated app itself the package and installation root. It removes
`node_modules`, `.expo`, and the previous Web artifact, creates the app-owned lockfile, performs a
cold `bun install --frozen-lockfile`, and hashes the lockfile before and after execution. The
generated Infra script then performs the static Web export with the app's own CLI and builds the app
image. The generated Minikube lifecycle loads and serves that image.

The exact `.ankh/web-export` artifact is first served directly and then through generated Infra.
Both paths must:

- render the generated static route;
- hydrate a Runtime-bound ZORA interaction and navigate to a dynamic route with search parameters;
- load scripts, styles, images, fonts, and other browser resources without failed requests;
- produce no React hydration/recoverable-render mismatch, uncaught exception, or unexpected warning;
- fit both a 390 px mobile viewport and a 1440 px desktop viewport without horizontal overflow.

This preserves the normal Ankhorage application path: manifest-generated routes and UI are rendered
through Runtime and ZORA, while the ordinary generated Infra adapter serves the resulting artifact.
There is no Studio-only production runtime.

## Native and CNG baseline

The generated configuration keeps native directories disposable. A clean
`<app>/node_modules/.bin/expo prebuild --clean --no-install` regenerates Android and iOS from app
config and released config plugins. The canonical floor is:

| Target       | Baseline                                                  |
| ------------ | --------------------------------------------------------- |
| Android      | Android 7 / API 24 minimum; compile SDK 36; target SDK 36 |
| iOS          | iOS 16.4 minimum; Xcode 26.4 or newer                     |
| React Native | New Architecture only                                     |

The standalone Expo 57 Studio consumer evidence records clean Android Debug and Release builds and
clean iOS Debug and Release builds on Xcode 26.6, plus rebuilt Expo 57 development clients. SDK 54
clients and hand-maintained native migration patches are not accepted as evidence. The generated
capability acceptance independently performs Web/Android/iOS JavaScript export, clean CNG, and
asserts the manifest-derived native permissions, schemes, identifiers, iOS deployment target, and
Expo-owned platform configuration.

## Completed publication and owner-graph gates

All publication gates were completed on 2026-08-27 before final acceptance:

| Owner                     | Accepted registry version | React Native contract |
| ------------------------- | ------------------------- | --------------------- |
| `@ankhorage/studio`       | `2.0.9`                   | `0.86.x`              |
| `@ankhorage/expo-runtime` | `3.0.6`                   | exact `0.86.3`        |
| `@ankhorage/runtime`      | `2.2.1`                   | `0.86.x`              |
| `@ankhorage/surface`      | `3.0.1`                   | `0.86.x`              |
| `@ankhorage/zora`         | `3.0.1`                   | `0.86.x`              |
| `@ankhorage/infra`        | `4.1.3`                   | not RN-facing         |

The RN-facing portable owners intentionally support the React Native 0.86 patch line, while Expo
Runtime remains the exact Expo 57 platform authority. Studio 2.0.9 contains the public peer-metadata
change and raised released-owner floors; it was published separately before this issue branch
consumed it.

The standalone and generated-capability runners now scan the physical Bun installation graph. They
require exactly one React Native installation at 0.86.3, reject every incompatible
`@ankhorage/*` React Native peer, and require the released owner versions above. Both runners passed
from fresh package/install roots with cold frozen installs. The production Infra E2E also passed
against the released Infra package through Docker, Minikube and browser hydration.

The final native fixture additionally resolved `@ankhorage/devtools@1.7.0`, which contains the
canonical generated `knip:check` script fix needed for Expo Doctor. Expo Doctor passed 21/21, and
fresh Android and iOS Development and Release builds were installed and launched from the same
single-RN 0.86.3 graph. No workspace, source, `file:`, `link:`, global CLI, `bunx`, or registry
fallback was used.
