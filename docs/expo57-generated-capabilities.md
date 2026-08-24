# Expo 57 generated capability acceptance

Issue #312 owns a capability-specific acceptance path for ordinary generated Ankhorage apps. The
fixture is generated through `ProjectManager`, consumes released owner packages from the registry,
and remains separate from the Expo Router navigation runner.

Run it with:

```bash
bun run test:acceptance:expo57-generated-capabilities
```

The current acceptance slice proves:

- a clean frozen workspace install that leaves the generated lockfile byte-for-byte unchanged;
- exact released owner versions for Expo Runtime, permissions and Supabase Auth;
- owner-projected Expo 57 packages and config plugins for camera/scanner, microphone, media-library,
  location and notifications declarations;
- canonical Web/native OAuth transport, target schemes and Secure Store session persistence source;
- the generated `BarcodeScannerView` bridge consumes `ExpoBarcodeScannerAdapter` through the
  generated extension registry;
- no generated `expo-av`, `expo-permissions`, `expo/fetch`, legacy OAuth transport key or legacy
  FileSystem read API;
- Expo Router declarations exist before TypeScript 6 runs;
- Expo dependency compatibility, Expo Doctor, React Compiler health, Web export, Android/iOS
  JavaScript exports and clean CNG prebuild;
- Android and iOS prebuild output contains the expected app schemes and app-owned permission
  declarations.

Focused CI tests separately execute deterministic global-fetch/auth behavior, OAuth success,
single-exchange replay, missing/malformed/mismatched/expired correlation rejection, cancellation
cleanup, native browser transport, and media-picker selection/cancellation. Studio's deploy image
picker now consumes the same released Expo Runtime media adapter as generated Studio integration
instead of maintaining a direct DocumentPicker/FileSystem path.

This acceptance is build/configuration evidence. It does not claim native permission dialogs,
Secure Store behavior, system picker UI, camera preview, native OAuth return, or process-restart
behavior without an actual rebuilt development client. Xcode and iOS Simulator runtimes are
available in the current implementation environment; no Android emulator/device is currently
connected. Full generated auth lint cleanup, an iOS development-client run, Android runtime
evidence, and the capability Web browser/hydration smoke remain #312 work. The complete
permission-state matrix remains blocked on
[ankhorage/permissions#16](https://github.com/ankhorage/permissions/issues/16), which owns Expo
adapter normalization for the already-portable blocked/limited states, iOS notification
authorization detail, and settings recovery.
