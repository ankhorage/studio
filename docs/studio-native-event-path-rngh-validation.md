# Issue #156 Native Event-Path and Gesture-Arbitration Spike

## Harness Variables

- Probe path: `/private/tmp/ankh-studio-native-event-path-probe`
- Node version: `26.3.0`
- Emulator: `Pixel_8_Pro_API_34-ext11` (`emulator-5554`)
- App package: `com.faebster.ankhstudionativeeventpathprobe`
- Architecture: New Architecture with Fabric/Bridgeless (`"fabric":true`)

## Harness Result

Manual mouse input inside the Android emulator reliably reached React Native.

The earlier `HARNESS BLOCKED` conclusion based on `adb shell input` was superseded.

## Entry and Cache Findings

### Actual native entry chain

1. `MainApplication.kt` → `getJSMainModuleName()` returns `.expo/.virtual-metro-entry`
2. Expo virtual entry → Expo Router stack navigator
3. `app/_layout.tsx` → `Stack.Screen name="index"`
4. `app/index.tsx` → `ProbeScreen` component
5. `index.js` exists but is **not** loaded by the native app

### Stale Metro and bundle cache

- Two stale Expo/Metro processes were found running from `~/git/studio`:
  - PID 45749 on port `8081` (stale, serving Studio project)
  - PID 91924 on port `8082` (stale, serving Studio project)
- The probe's intended Metro on port `8081` was not running.
- The installed Android app had a cached `files/BridgelessReactNativeDevBundle.js` (7.5 MB) containing an older Edit-mode bundle.
- This cache persisted across `pm clear` and app restarts.

### Repair applied

- Killed the stale port-8081 Metro process.
- Started Metro from the disposable probe with `--clear`.
- Deleted `files/BridgelessReactNativeDevBundle.js` from the installed app.
- Fixed an accidental duplicate `function Root()` syntax corruption in `index.js` that caused a bundle parse error.
- Confirmed startup log: `[PROBE_START_MODE] preview`
- Confirmed visible UI: `Mode: preview`

### Edit mode restoration

`INITIAL_MODE` was restored to `'edit'`. After full restart:

- Startup log: `[PROBE_START_MODE] edit`
- Visible UI: `Mode: edit`

## Event-Path Resolution

### Nested Card

PASS — marker capture observed.

### Exposed Panel

PASS — marker capture observed.

### Absolute front

PASS — marker capture observed in visually overlapping region.

### Absolute back

PASS — marker capture observed in exposed back region.

### Classification

Event-path resolution for passive and overlapping nodes:
PARTIAL GO

Interactive authored controls did not participate correctly in the complete Edit selection flow.

## Button Edit Result

BUTTON PRESS executed in Edit mode.
No successful suppression was observed.

Event-path / ownership result:
INCOMPLETE

Authored-action suppression:
FAIL

## Disclosure Edit Result

DISCLOSURE TOGGLE executed in Edit mode.
The component-local state changed.

Event-path / ownership result:
INCOMPLETE

Internal-state suppression:
FAIL

## Preview Result

### Button Preview

PASS

- `BUTTON PRESS` exactly once
- action count 0 → 1
- no marker capture
- no Studio selection

### Disclosure Preview

PASS

- `DISCLOSURE TOGGLE` exactly once
- count 0 → 1
- Closed → Open
- no marker capture
- no Studio selection

## Final Architecture Outcome

GESTURE-ARBITRATION NO-GO

Native event-path markers can identify passive and overlapping nodes. The platform's visual hit order can be reused without rectangle hit testing.

However, the tested Studio-only marker plus root RNGH architecture cannot suppress authored Button and Disclosure interactions in Edit mode. Preview behavior is correct. The failure is gesture/action arbitration, not geometry.

`RuntimeNodeObserver` would not solve this suppression problem.

No shared Runtime extension is approved by this evidence.
No production implementation is approved.

## Architecture Conclusion

Geometry and global rectangle hit testing are not the primary blocker.

The unresolved blocker is an Edit interaction policy capable of preventing both:

1. Runtime-dispatched authored actions
2. Component-local authored interactions and state changes

while preserving:

- ScrollView
- nested scrolling
- drag and drop
- cancellation
- long press
- accessibility neutrality

Do not propose a concrete new public API as approved.
