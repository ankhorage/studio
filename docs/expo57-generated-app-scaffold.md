# Expo 57 generated-app scaffold

Studio generates ordinary Expo 57 applications from the released Ankhorage platform owners. Studio
chooses the packages and capabilities a generated app needs;
`@ankhorage/expo-runtime/platform` is the only owner of Expo, React Native, React, navigation,
animation, Expo module, Node and TypeScript compatibility versions.

## Released owner baseline

The scaffold consumes these released owners:

| Owner                                              | Generated or Studio range | Role                                                                             |
| -------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------- |
| `@ankhorage/expo-runtime`                          | `^3.0.1`                  | Expo 57 platform projection, planning and focused action bridge                  |
| `@ankhorage/runtime`                               | `^2.2.0`                  | manifest rendering and bindings                                                  |
| `@ankhorage/zora`                                  | `^3.0.0`                  | app UI; brings `@ankhorage/surface@^3.0.0` through its released dependency graph |
| `@ankhorage/react-native-reanimated-dnd-web`       | `^0.4.0`                  | Studio authoring drag-and-drop                                                   |
| `@ankhorage/orchestrator-module-expo-localization` | `^0.6.0`                  | localization module host/admin contribution                                      |
| `@ankhorage/orchestrator-module-expo-google-fonts` | `^0.2.1`                  | Google Fonts module host contribution                                            |
| `@ankhorage/devtools`                              | `^1.6.0`                  | generated and repository quality tooling                                         |

No generated dependency uses `workspace:`, `link:`, `file:`, a Git branch or a sibling-source path.
Standalone output omits `@ankhorage/studio` and binds actions through Expo Runtime 3's public action
bridge; Studio-enabled output adds the published Studio package and its authoring-only picker
dependencies. Studio-enabled output requires `@ankhorage/studio@^2.0.0`; the Expo 57 peer-surface
change is a breaking package release and cannot resolve an Expo 54-era Studio 1.x package.

## Direct Ankhorage dependency audit

The registry audit was performed on 2026-08-23. Each direct `@ankhorage/*` dependency in the Studio
root package is classified below.

### Update required for Expo 57

| Dependency                                         | Previous  | Decision                                         |
| -------------------------------------------------- | --------- | ------------------------------------------------ |
| `@ankhorage/expo-runtime`                          | `^2.6.0`  | update to released `^3.0.1` platform owner       |
| `@ankhorage/runtime`                               | `^2.1.0`  | update to released `^2.2.0` runtime owner        |
| `@ankhorage/zora`                                  | `^2.13.2` | update to released `^3.0.0` Expo 57 UI owner     |
| `@ankhorage/react-native-reanimated-dnd-web`       | `^0.3.2`  | update to released `^0.4.0` animation owner      |
| `@ankhorage/orchestrator-module-expo-localization` | `^0.5.2`  | update to released `^0.6.0` Expo 57 module owner |
| `@ankhorage/orchestrator-module-expo-google-fonts` | `^0.2.0`  | update to released `^0.2.1` Expo 57 module owner |
| `@ankhorage/devtools`                              | `1.5.1`   | update to released `^1.6.0` canonical tooling    |

### Verified current / no change required

`@ankhorage/color-theory@^0.0.8`, `@ankhorage/contracts@^8.0.0`,
`@ankhorage/data-sources@^2.0.0`, `@ankhorage/deploy@^0.12.0`,
`@ankhorage/infra@^4.1.1`, `@ankhorage/orchestrator@^0.3.1`,
`@ankhorage/supabase-auth@^1.2.1`, `@ankhorage/supabase-storage@^0.2.0`,
`@ankhorage/supabase-vault@^0.2.4`, `@ankhorage/templates@^7.0.0`,
`@ankhorage/zora-chess@^0.1.2` and `@ankhorage/zora-tabletop@^0.0.5` match their current
released owner baselines.

`apps/studio` has one direct Ankhorage dependency of its own: `@ankhorage/studio@latest`. That is
the published package boundary the first-party app exercises; all of its remaining Ankhorage owners
come through the root workspace package and the released dependency graph audited below.

### Separate owner or roadmap step

- `@ankhorage/ankh@^0.8.1` already admits the current compatible 0.8 release line; CLI evolution is
  not an Expo scaffold responsibility.
- `@ankhorage/paradox@^0.1.21` already admits the current compatible 0.1 release line; docs tooling
  evolution is independent of the Expo scaffold.
- The remaining direct `@react-navigation/*` application imports and their package dependencies are
  intentionally left visible for `[expo 8]` / issue #311. This migration adds no alias or shim.

## Canonical platform projection

The generated package map reads package names and versions directly from `EXPO_PLATFORM`. The
released 3.0.0 projection used by this migration is:

```text
Expo                         ~57.0.15
React                        19.2.3
React DOM                    19.2.3
React Native                 0.86.2
React Native Web             ~0.21.0
Expo Router                  ~57.0.15
React Native Screens         ~4.26.0
safe-area-context             ~5.7.0
Gesture Handler              ~2.32.0
Reanimated                   4.5.1
Worklets                     0.10.1
TypeScript                   ~6.0.3
Node policy                  24.x
```

Studio contains no second Expo/RN/tooling version table.

## Expo 57 default-template delta

The comparison fixture was created with the actual Expo command
`create-expo-app@latest --template default@sdk-57` on 2026-08-23.

| Area                      | Decision                                                                                                                                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json/main`       | Migrate to direct `expo-router/entry`; no wrapper entry file is generated.                                                                                                                           |
| Router config plugin      | Migrate to the default `expo-router` config plugin. Runtime-plan plugins and an optional splash plugin remain capability-driven additions.                                                           |
| Typed routes              | Migrate to `experiments.typedRoutes: true` and include `.expo/types/**/*.ts` plus `expo-env.d.ts` in TypeScript.                                                                                     |
| React Compiler            | Migrate to `experiments.reactCompiler: true`. Expo 57 owns the automatic Babel setup; no broad opt-out is generated.                                                                                 |
| Babel                     | Migrate to the Expo default: no `babel.config.js`, module-resolver alias or explicit Worklets plugin. Expo resolves the required `@` and `@root` TypeScript paths.                                   |
| Metro                     | Migrate to the Expo default: no `metro.config.js` or singleton `resolveRequest`. Expo SDK 52+ automatically supports Bun workspaces and symlinks.                                                    |
| TypeScript                | Use the platform-owned `~6.0.3` with additional Ankhorage strictness, Node types for generated scripts and the `@`/`@root` source aliases.                                                           |
| Expo modules              | Use only modules required by Router, generated Runtime capabilities, optional Studio authoring and optional auth. Expo default showcase-only packages are intentionally omitted.                     |
| ZORA native peers         | Replace deprecated `@expo/vector-icons` with the released ZORA 3/Surface 3 `@react-native-vector-icons/*` peer contract.                                                                             |
| Static web                | Keep `web.output: 'static'` and an app-owned `expo export --platform web` script.                                                                                                                    |
| CNG                       | Keep `android/` and `ios/` absent from source. App config and released config plugins feed clean `expo prebuild`; generated native files are disposable output.                                      |
| Android                   | Expo 57 owns API 24 minimum, compile/target SDK 36 and edge-to-edge defaults. Ankhorage adds only manifest-derived package identity, scheme and permissions.                                         |
| iOS                       | Expo 57 owns the iOS 16.4/Xcode 26.4 native baseline. Ankhorage adds only manifest-derived bundle identity and scheme.                                                                               |
| App presentation defaults | Orientation, example-template icons and showcase UI remain intentionally app/template-owned rather than hard-coded platform policy. Existing generated icon assets and web favicon remain supported. |
| Navigation implementation | Existing navigation generation remains unchanged and visible for issue #311; no compatibility alias is introduced here.                                                                              |
| Project-root isolation    | Workspace/lockfile ownership remains unchanged for issue #180. A clean disposable fixture is acceptance evidence only.                                                                               |

The Babel and Metro removals follow Expo's default-first configuration guidance. A custom file must
return only when a current generated-app reproduction proves that Expo defaults fail and the
surviving override has focused behavioral coverage.

## Acceptance boundary

A representative fixture must be created through `ProjectManager`, use released registry owner
packages (with only the Studio candidate itself packed when necessary), and validate from its own
package root:

```bash
bun install --frozen-lockfile --linker=hoisted
bun run lint
expo install --check
expo-doctor
bun run typecheck
bunx react-compiler-healthcheck@latest
expo export --platform web
expo export --platform android
expo export --platform ios
expo prebuild --clean --no-install
```

Native export and clean prebuild validate JavaScript bundling and CNG/config generation; they are not
claims of native binary compilation.

The package-owned `test:acceptance:expo57-generated-app` runner creates this fixture through
`ProjectManager` for every pull request and push to `main`. Its dedicated CI job selects Node 24,
starts from a cold frozen install, and executes the app-owned lint and platform commands from the
generated project directory. The hoisted linker gives Expo Doctor one physical installation of each
native module. Standalone layouts import the focused
`@ankhorage/expo-runtime/action-bridge` entrypoint, so camera-free manifests do not declare or
install `@ankhorage/permissions` or `expo-camera`; the acceptance runner asserts both the generated
manifest and installed dependency graph stay free of both packages. The Studio
edit-selection/Gesture Handler regression is deliberately outside this standalone scaffold gate and
retains its focused follow-up boundary.

The 2026-08-23 acceptance fixture was created and regenerated only through `ProjectManager`. Its
single-stack route topology deliberately exercises the #310 scaffold boundary without performing
the deferred navigation-owner migration in issue #311. From a cold frozen Bun install it passed
Expo dependency validation, Expo Doctor (21/21), TypeScript 6 and React Compiler healthcheck (4/4
components). Its app-owned CLI served hydrated Web HTML, emitted ten static routes, bundled Android
and iOS JavaScript, and completed clean CNG prebuild. The generated native output retained Expo 57's
edge-to-edge Android setting and iOS 16.4 deployment target.

## Architectural impact

Generated apps and `apps/studio` now share Expo's ordinary Router entry, compiler, Babel, Metro,
TypeScript, web and CNG defaults. Studio contributes authoring capabilities through released Runtime,
ZORA, adapter and module contracts instead of maintaining an upgraded copy of the Expo platform.
This narrows the architectural distance between the first-party Studio app and any generated
Ankhorage app without implementing issue #311, #265 or #180.
