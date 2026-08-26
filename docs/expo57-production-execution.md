# Expo 57 production execution

Issue `studio#314` owns the production-execution acceptance for generated Expo 57 apps. The app
remains the only Expo SDK, CLI, configuration, CNG, and native-build truth. Studio contributes the
generated app and acceptance orchestration; Infra owns the generated image-build implementation.

## Owner boundary

`ankhorage/infra#67` is implemented by Infra PR `#79`. Its generated `build-app-image.sh` resolves
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

## Publication gates

The implementation is intentionally split from publication availability:

1. `@ankhorage/studio` 2.0.8 is published. On 2026-08-27,
   `npm view @ankhorage/studio version` returned exactly `2.0.8` after GitHub reported Actions
   operational and the preceding incident resolved.
2. The standalone registry/frozen-install runner enforces this exact registry version before
   installing its fixture and then verifies that the fixture-owned package and lockfile also resolve
   exactly 2.0.8.
3. The generated Infra E2E must use the published Infra version containing PR `#79`. Until that
   version is in the registry and Studio's normal semver range resolves it, this is a documented
   external gate, not a reason to add a source override.

No new Studio changeset or 2.0.9 release is created for the Actions outage. After service recovery,
the release workflow only needs a fresh trigger; adding `workflow_dispatch` is handled as the small
release-workflow follow-up requested for that point in time.
