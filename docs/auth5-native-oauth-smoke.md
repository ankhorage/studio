# Auth 5 native OAuth smoke validation

This is the final manual validation gate for #193. Automated tests cover generation, target-aware schemes, Expo Go rejection, system-browser result classification, PKCE completion, cleanup, Infra redirect allowlists, and Doctor readiness. This smoke verifies the remaining real native-build boundary.

## Prepare the generated app

From the Studio repository:

```bash
bun run smoke:auth5-native:prepare -- /tmp/ankh-auth5-native-smoke
```

The fixture is Google-only and intentionally contains no Google client secret. Its native callbacks are:

```text
Android: ankh-auth5-android://auth/callback
iOS:     ankh-auth5-ios://auth/callback
```

Run Doctor against the generated `ankh.config.json` and confirm both native targets are ready, their exact schemes are shown, and the development/standalone-build requirement is reported.

## Activate the smoke project's own Auth Infra

Do not point the fixture at another project's active Auth redirect configuration. The smoke manifest owns the callback schemes above, so its own Infra projection must be reconciled before native validation.

Use an existing Studio project that has already stored the trusted Google **Web application** client ID and secret through the normal Auth/Secret flow. That project is only the credential source; its manifest and redirect allowlist are not changed.

From the Studio repository:

```bash
bun run smoke:auth5-native:infra -- \
  /tmp/ankh-auth5-native-smoke \
  --credentials-project <configured-project-id>
```

For example, if `nutri` owns the configured Google Web credential:

```bash
bun run smoke:auth5-native:infra -- \
  /tmp/ankh-auth5-native-smoke \
  --credentials-project nutri
```

The command:

- resolves the source project's enabled Google `credentialsRef` through the existing trusted `ProjectSecretService`;
- supplies that credential only to the smoke project's canonical `upProjectInfrastructure()` flow;
- reconciles GoTrue from the smoke manifest and its Android/iOS deploy targets;
- starts the smoke project's local Infra port-forward;
- writes the generated app `.env.local` with only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

No Google client secret, service-role key, provider token, or other trusted credential is copied into the generated app.

Verify the active GoTrue configuration before opening the native app:

```bash
kubectl exec -n supabase deploy/auth -- \
  printenv | grep -E 'GOTRUE_(SITE_URL|URI_ALLOW_LIST)'
```

The active allowlist must contain both:

```text
ankh-auth5-android://auth/callback
ankh-auth5-ios://auth/callback
```

If it still contains only another app's native scheme, do not continue the smoke. Re-run the smoke Infra command and investigate the canonical Infra reconciliation rather than mutating Kubernetes manually.

Confirm the gateway URL printed by the command is reachable, for example:

```bash
curl http://127.0.0.1:19600/auth/v1/settings
```

Use the actual gateway URL/port printed by the command if it differs.

## Android development build

Bridge the printed local gateway port to the Android device/emulator before starting OAuth. For a gateway on port `19600`:

```bash
adb reverse tcp:19600 tcp:19600
adb reverse --list
```

Then:

```bash
cd /tmp/ankh-auth5-native-smoke/apps/auth5-native-oauth-smoke
bun install
bun run android
```

Validate:

1. Google sign-in opens the system authentication browser, not an embedded WebView.
2. Successful authorization returns to `ankh-auth5-android://auth/callback` instead of the GoTrue site URL.
3. The PKCE code is exchanged once and the app reaches the authenticated state.
4. Relaunching the app restores the normalized session.
5. Cancelling authorization returns a recoverable cancelled outcome without a session.
6. Dismissing the system browser returns a recoverable cancelled outcome without a session.
7. A failed/unavailable browser path is recoverable and does not leave a pending OAuth attempt.

## iOS development build

On macOS with Xcode, use an iOS simulator or device:

```bash
cd /tmp/ankh-auth5-native-smoke/apps/auth5-native-oauth-smoke
bun run ios
```

Repeat the Android matrix and confirm successful authorization returns to:

```text
ankh-auth5-ios://auth/callback
```

Do not infer iOS completion from Android results. #193 remains open until the iOS development-build flow has executed successfully.

## Expo Go negative check

Expo Go is not an accepted Auth 5 native host. If the fixture is opened in Expo Go, starting OAuth must fail before `startAuthorization()` creates transport/PKCE state and must direct the developer to a development or standalone build.

## Evidence to record on #193

Record for each platform:

- date;
- emulator/simulator/device and OS version;
- development-build command used;
- callback scheme observed;
- successful Google roundtrip;
- cancel result;
- dismiss result;
- relaunch/session restoration result;
- confirmation that the Google credential is a Web application client and that no trusted provider credential was embedded in the app.

Close #193 only after Android and iOS development-build success are both recorded. A simulator/device availability blocker should be documented explicitly rather than treating deterministic CI coverage as real-device evidence.
