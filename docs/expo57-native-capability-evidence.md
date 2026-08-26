# Expo 57 native capability evidence

Issue #312 uses this package-owned host harness for native-runtime evidence that export, hydration
and CNG cannot provide. The harness creates a fresh app through the released
`@ankhorage/studio` host, installs the released owner graph, adds only test-app routes and a
deterministic local OAuth provider, then regenerates native projects for development clients. It
does not add a public Studio API or modify `apps/studio`.

The protected `/` route remains the Studio-generated Runtime route. The evidence controller uses
the generated auth route path with a harness-owned screen plus an unguarded `/native-evidence`
route, and successful authentication returns to the generated protected route. Permission, media
and OAuth behavior is exercised through the public Permissions, Expo Runtime and Supabase Auth
adapters rather than locally reproduced owner logic.

## Recorded released baseline

Recorded on 2026-08-25 from fresh workspaces and cold frozen installs:

| Item            | Recorded value                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Generator       | `@ankhorage/studio@2.0.6`, resolved and installed from the public registry                                                     |
| Owners          | `@ankhorage/devtools@1.6.1`, `@ankhorage/expo-runtime@3.0.5`, `@ankhorage/permissions@0.2.3`, `@ankhorage/supabase-auth@1.2.6` |
| Expo graph      | Expo `57.0.16`, Router `57.0.16`, Dev Client `57.0.15`, Document Picker `57.0.1`, Image Picker `57.0.13`                       |
| TypeScript      | `6.0.3`                                                                                                                        |
| Host toolchain  | Bun `1.3.14`, Node `24.19.0`, Xcode `26.6 (17F113)`                                                                            |
| iOS runtime     | iPhone 17 Pro simulator, iOS 26.5                                                                                              |
| Android runtime | Pixel 8 Pro emulator, Android 14 / API 34                                                                                      |
| Application     | `com.ankhorage.expo57nativeevidence`, version `1.0.0 (1)`, clean Debug development-client builds                               |

This table remains the last completed native run; it is not rewritten as prospective evidence. The
harness now targets Studio 2.0.8 for the final registry-only repetition, but that run remains blocked
until `npm view @ankhorage/studio version` returns 2.0.8. Only then may the recorded baseline and
rebuilt-client evidence be advanced.

The preparation gate passed twice in independent fresh workspaces. Each run:

- resolved the exact registry versions above;
- created lockfiles followed by no-cache frozen installs without lockfile mutation;
- generated through the released `ProjectManager` host path;
- ran Devtools sync twice and proved the second run byte-stable;
- passed generated-app format and lint, Expo dependency compatibility, Expo Doctor `21/21`, Expo
  Router type generation, TypeScript 6, and React Compiler health `27/27`;
- exported Web, Android and iOS JavaScript; and
- regenerated clean Android and iOS native projects and asserted callback schemes, plugins and
  permission declarations.

The final clients were then built from the clean native projects with native build caches disabled,
installed, and booted. Both executable identities and the evidence log fingerprint were retained
locally; they are intentionally not published with the redacted evidence.

## Native evidence matrix

`Client` means the result came from the rebuilt development client, `System UI` means the platform
picker, browser, permission or settings UI was used, and `Automated` means the harness asserted the
result and count invariants. No export or prebuild result substitutes for a native-runtime claim.

| Scenario                                          | iOS 26.5 result                                                         | Android 14 / API 34 result                                                                 | Evidence                     |
| ------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------- |
| Clean development-client build, install and boot  | Passed                                                                  | Passed                                                                                     | Native build, client         |
| OAuth success and configured-scheme callback      | Authenticated; one authorization and exactly one PKCE exchange          | Authenticated; one authorization and exactly one PKCE exchange                             | Client, System UI, automated |
| Post-auth route continuity                        | Returned to the generated protected Runtime route                       | Returned to the generated protected Runtime route                                          | Client                       |
| SecureStore process restart                       | Session restored after termination and relaunch with no second exchange | Session restored after force-stop and relaunch with no second exchange                     | Client, automated            |
| OAuth user cancellation                           | Native browser cancellation recorded without a session or exchange      | Native browser cancellation recorded without a session or exchange                         | Client, System UI, automated |
| Provider denial                                   | Not repeated; Android exercised the same released callback controller   | Cancelled terminal result; no session or exchange                                          | Client, automated            |
| Malformed callback                                | Not repeated; Android exercised the same released callback controller   | Rejected as unexpected callback parameters; no exchange                                    | Client, automated            |
| Exact replay and mismatched callback              | Not repeated; Android exercised the same released callback controller   | Neither caused a second token exchange                                                     | Client, automated            |
| Document picker selection and cancellation        | `selected` as kind `file`; `cancelled`                                  | `selected` as kind `file`; `cancelled`                                                     | Client, System UI            |
| Image picker selection and cancellation           | `selected` as kind `image`; `cancelled`                                 | `selected` as kind `image`; `cancelled`                                                    | Client, System UI            |
| Microphone permission lifecycle                   | Not repeated after Android completed the native lifecycle               | `unknown` -> `denied` / re-requestable -> `blocked` / not re-requestable -> settings grant | Client, System UI            |
| Open application settings                         | Shared platform action retained                                         | Opened the application settings screen                                                     | Client, System UI            |
| Camera availability                               | Unavailable in the simulator; no preview or scan claimed                | Unavailable in the emulator despite a virtual-scene camera; no preview or scan claimed     | Client                       |
| Physical preview and representative scanner event | Requires physical camera hardware; retained for `[expo 12]`             | Requires suitable camera hardware; retained for `[expo 12]`                                | Not claimed                  |

The OAuth fixture observed three successful exchanges in total: the iOS success and two Android
success runs separated by an intentional app-data reset. Termination/relaunch, exact replay,
mismatched callback, malformed callback, provider denial and user cancellation did not add an
exchange. The harness classifies only finite, allowlisted outcome categories.

The evidence log contains status, boolean, count, platform and media-kind fields only. It never
stores or reports authorization URLs, callback values, access or refresh tokens, authorization
headers, SecureStore contents, selected document names, media names or media bytes. Synthetic test
documents and images were used; no personal media was selected. Screenshots were used only for
local interaction calibration and are not published.

The Android development launcher initially attempted a LAN Metro URL. With the already configured
ADB reverse tunnel, reopening the development client against loopback loaded the same fresh build;
this was an environment launch-URL issue, not an Expo Runtime or generated-app defect.

## Reproduce the released-only fixture

Use Node 24 and a fresh absolute workspace path. The deterministic provider uses synthetic
runtime-only values and no provider credentials:

```bash
bun install --frozen-lockfile
bun run smoke:expo57-native -- prepare "$EVIDENCE_WORKSPACE"
```

Start the redacted provider/evidence service in terminal 1:

```bash
bun run smoke:expo57-native -- serve "$EVIDENCE_WORKSPACE"
```

Start Metro from the generated app in terminal 2, using loopback (and ADB reverse on Android):

```bash
cd "$EVIDENCE_WORKSPACE/apps/expo-57-native-capability-evidence"
REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1 \
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:48757 \
EXPO_PUBLIC_SUPABASE_ANON_KEY=synthetic-public-anon-key \
EXPO_PUBLIC_NATIVE_EVIDENCE_URL=http://127.0.0.1:48757 \
./node_modules/.bin/expo start --dev-client --lan --clear
```

Build and install the clients after preparation:

```bash
./node_modules/.bin/expo run:ios --device <ios-device> --no-bundler --no-build-cache
./node_modules/.bin/expo run:android --device <android-device> --no-bundler --no-build-cache
```

Queue one scenario and read the redacted state:

```bash
bun run smoke:expo57-native -- queue oauth-success
bun run smoke:expo57-native -- state
```

Supported scenarios are `oauth-success`, `oauth-cancel`, `oauth-malformed`,
`oauth-provider-denied`, `prepare-deep-link`, `session-restored`, `permission-status`,
`permission-request`, `open-settings`, `pick-document`, `pick-image`, `camera-availability`,
`reset-auth`, and `scanner`. Permission scenarios take a second argument, for example:

```bash
bun run smoke:expo57-native -- queue permission-request microphone
```

Only the physical-camera preview and representative optical scanner callback remain outside this
issue. They are not prerequisites for the released SDK 57 generated-capability baseline and remain
owned by `[expo 12]`, which carries the exhaustive QR/EAN-13/EAN-8 device matrix.
