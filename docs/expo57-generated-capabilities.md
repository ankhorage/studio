# Expo 57 generated capability acceptance

Issue #312 owns a capability-specific acceptance path for ordinary generated Ankhorage apps. The
fixture is generated through `ProjectManager`, consumes released owner packages from the registry,
and remains separate from the Expo Router navigation runner.

Run it with:

```bash
bun run test:acceptance:expo57-generated-capabilities
```

The current acceptance slice proves:

- a clean frozen install from the generated app's own package root that leaves its lockfile
  byte-for-byte unchanged;
- exact released owner versions for Expo Runtime, permissions and Supabase Auth;
- owner-projected Expo 57 packages and config plugins for camera/scanner, microphone, media-library,
  location and notifications declarations;
- canonical Web/native OAuth transport, target schemes and Secure Store session persistence source;
- native OAuth PKCE entropy injected from the Expo-owned `expo-crypto` CSPRNG without a global
  Crypto shim;
- the generated `BarcodeScannerView` bridge consumes `ExpoBarcodeScannerAdapter` through the
  generated extension registry;
- no generated `expo-av`, `expo-permissions`, `expo/fetch`, legacy OAuth transport key or legacy
  FileSystem read API;
- a pristine generated source tree passes its complete app-owned `format:check` and `lint` scripts,
  and those checks do not change any source file;
- Expo Router declarations exist before TypeScript 6 runs;
- Expo dependency compatibility, Expo Doctor, React Compiler-backed Web export, Android/iOS
  JavaScript exports and clean CNG prebuild;
- Android and iOS prebuild output contains the expected app schemes and app-owned permission
  declarations;
- the served static Web export hydrates direct `/sign-in`, `/sign-up`, `/auth/callback` and `/`
  requests, survives reload plus Back/Forward, rejects an expired OAuth attempt without a token
  exchange, keeps only the callback route reachable after authentication, rejects a mismatched
  callback even with a valid session, treats the exact completed replay idempotently without a
  second exchange, exposes that replay-specific completion in the hydrated callback UI, and renders
  the controlled Web camera-permission fallback.

The registry baseline asserted by this slice is `@ankhorage/expo-runtime@3.0.4`,
`@ankhorage/permissions@0.2.3`, and `@ankhorage/supabase-auth@1.2.5`, with Expo and Expo Router
`~57.0.15`. Browser acceptance uses a deterministic local Auth transport that contains no real
credentials. Pending, expired and completed correlation state is created through the released
adapter's public authorization/completion flow; the harness does not reproduce owner-private
storage keys, schemas or callback fingerprints. The single valid completion must exchange exactly
once, while mismatched and replayed callbacks must not reach the token endpoint again.

Focused CI tests separately execute deterministic global-fetch/auth behavior, OAuth success,
single-exchange replay, missing/malformed/mismatched/expired correlation rejection, cancellation
cleanup, native browser transport, and media-picker selection/cancellation. Studio's deploy image
picker now consumes the same released Expo Runtime media adapter as generated Studio integration
instead of maintaining a direct DocumentPicker/FileSystem path.

This acceptance is build/configuration evidence. It does not claim native permission dialogs,
Secure Store behavior, system picker UI, camera preview, native OAuth return, or process-restart
behavior by itself. Those checks were completed separately with freshly rebuilt iOS and Android
development clients on the exact final released baseline. Bundle, static export and CNG prebuild
evidence did not substitute for the native runtime checks.

The package-owned development-client harness, recorded iOS/Android results, redaction rules and the
physical-camera boundary are documented in
[Expo 57 native capability evidence](expo57-native-capability-evidence.md).
