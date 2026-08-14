# Auth 5 native OAuth smoke validation

This is the final manual validation gate for #193. Automated tests cover generation, target-aware schemes, Expo Go rejection, system-browser result classification, PKCE completion, cleanup, Infra redirect allowlists, and Doctor readiness. This smoke verifies the remaining real native-build boundary.

## Prepare the generated app

From the Studio repository:

```bash
bun run smoke:auth5-native:prepare -- /tmp/ankh-auth5-native-smoke
cd /tmp/ankh-auth5-native-smoke/apps/auth5-native-oauth-smoke
bun install
```

The fixture is Google-only and intentionally contains no Google client secret. Its native callbacks are:

```text
Android: ankh-auth5-android://auth/callback
iOS:     ankh-auth5-ios://auth/callback
```

Run Doctor against `ankh.config.json` and confirm both native targets are ready, their exact schemes are shown, and the development/standalone-build requirement is reported.

## Connect a configured Auth backend

Use an Auth backend that has already been configured through the normal Ankhorage Auth/Infra flow with one Google **Web application** client ID and secret. The backend remains the Google OAuth client.

Verify before launching the app:

- the provider-to-Auth-backend callback registered in Google is unchanged;
- the backend redirect allowlist contains both native callbacks above;
- `.env.local` in the generated app contains only the public runtime values `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`;
- no Google client secret, service-role key, provider token, or other trusted credential is copied into the generated app.

## Android development build

Use an Android emulator or device with the Android SDK configured:

```bash
bun run android
```

Validate:

1. Google sign-in opens the system authentication browser, not an embedded WebView.
2. Successful authorization returns to `ankh-auth5-android://auth/callback`.
3. The PKCE code is exchanged once and the app reaches the authenticated state.
4. Relaunching the app restores the normalized session.
5. Cancelling authorization returns a recoverable cancelled outcome without a session.
6. Dismissing the system browser returns a recoverable cancelled outcome without a session.
7. A failed/unavailable browser path is recoverable and does not leave a pending OAuth attempt.

## iOS development build

On macOS with Xcode, use an iOS simulator or device:

```bash
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
