# Studio Canvas Selection Native Feasibility

## Gate 0 Result

Status: **NO-GO / blocked**

The full non-invasive Studio canvas selection architecture must not be implemented yet.
Gate 0 did not produce a GO result because:

- Android executed and measured, but the proposed native instrumentation boundary was not measurable.
- iOS could not be executed in this environment because Xcode has an iOS Simulator SDK/runtime mismatch.

This report is intentionally limited to Gate 0. It does not approve a web-only fallback and does
not approve implementing the full selection architecture.

## Probe Scope

The disposable probe was created under:

```text
/private/tmp/studio-canvas-gate0
```

It rendered baseline and instrumented versions of:

- `Stack`
- `Inline`
- `Grid`
- `Text`
- `Card`
- `Button`
- nested Runtime-node-shaped boundaries

The proposed native boundary used:

```tsx
<View collapsable={false} pointerEvents="box-none" style={{ display: 'contents' }}>
  {children}
</View>
```

The probe measured:

- native handles with `findNodeHandle`
- bounds with `measureInWindow`
- baseline vs instrumented container and leaf geometry
- selected chrome overlay geometry
- coordinate hit-testing from measured bounds for nested Runtime nodes

Compilation and type support were not treated as evidence.

## Android Evidence

Platform executed:

```text
Pixel_8_Pro_API_34-ext11
Android emulator serial: emulator-5554
React Native: 0.81.5
Expo: 54.0.36
```

Commands executed:

```bash
emulator -avd Pixel_8_Pro_API_34-ext11 -no-window -no-audio -no-snapshot -gpu swiftshader_indirect
adb shell getprop sys.boot_completed
expo prebuild --platform all --no-install
expo run:android
```

Android build, install, and JS execution completed. The probe emitted:

```text
GATE0_RESULT ... "platform":"android" ... "pass":false
```

Important measured result:

```json
{
  "platform": "android",
  "uiManagerAvailable": true,
  "cases": [
    { "type": "Stack", "boundaryMeasurable": false, "boundary": { "width": 0, "height": 0 } },
    { "type": "Inline", "boundaryMeasurable": false, "boundary": { "width": 0, "height": 0 } },
    { "type": "Grid", "boundaryMeasurable": false, "boundary": { "width": 0, "height": 0 } },
    { "type": "Text", "boundaryMeasurable": false, "boundary": { "width": 0, "height": 0 } },
    { "type": "Card", "boundaryMeasurable": false, "boundary": { "width": 0, "height": 0 } },
    { "type": "Button", "boundaryMeasurable": false, "boundary": { "width": 0, "height": 0 } },
    {
      "type": "NestedRuntime",
      "boundaryMeasurable": false,
      "boundary": { "width": 0, "height": 0 }
    }
  ],
  "hitTest": {
    "expected": "nested-child",
    "actual": "nested-child",
    "passed": true
  },
  "selectedChrome": {
    "selectedBounds": { "width": 0, "height": 0 },
    "overlayBounds": { "width": 4, "height": 4 },
    "passed": false
  }
}
```

Android conclusion:

- Native handles existed for the boundary nodes.
- The boundary was not meaningfully measurable: every instrumented boundary measured `0x0`.
- Coordinate hit-testing only passed because both nested boundaries collapsed to a zero-size point;
  that is not sufficient for real canvas selection.
- Selected chrome could not align to a meaningful selected node rectangle.

Android is therefore **NO-GO** for the proposed boundary.

## iOS Evidence

Available simulator query succeeded with escalation:

```bash
xcrun simctl list devices available
```

Available devices included bootable iOS simulators, and this simulator was booted:

```text
iPhone 16 Pro (19CA5E47-EB9E-4B7E-B533-29E137F08954) (Booted)
```

The iOS simulator did not have Expo Go installed:

```bash
xcrun simctl get_app_container booted host.exp.Exponent
```

Result:

```text
No such file or directory
```

A disposable native iOS shell was generated and CocoaPods installed, but Xcode could not build to
any simulator destination:

```bash
expo prebuild --platform all --no-install
expo run:ios --device 19CA5E47-EB9E-4B7E-B533-29E137F08954
expo run:ios --device "iPhone 16 Pro"
xcodebuild -workspace /private/tmp/studio-canvas-gate0/ios/StudioCanvasGate0.xcworkspace \
  -scheme StudioCanvasGate0 -showdestinations
```

Xcode result:

```text
Unable to find a destination matching the provided destination specifier
Ineligible destinations for the "StudioCanvasGate0" scheme:
  { platform:iOS, name:Any iOS Device, error:iOS 26.5 is not installed. }
```

Installed SDKs/runtimes:

```text
xcodebuild -showsdks:
  iOS Simulator SDK 26.5

xcrun simctl list runtimes:
  iOS 18.0
  iOS 18.5
  iOS 26.2
```

iOS conclusion:

- iOS did not execute the React Native probe.
- The blocker is local environment availability, not TypeScript or source compatibility.
- Manual iOS Gate 0 evidence is required before implementing the full architecture.

## Required Next Step

Do not implement the full canvas selection architecture until both conditions are met:

1. Android has a revised native boundary or measurement strategy that returns meaningful non-zero
   bounds while preserving layout transparency for every required fixture.
2. iOS executes the same native feasibility probe, or an equivalent committed probe, on a simulator
   or device and records layout transparency, measurability, selected chrome, and coordinate
   hit-testing evidence.

Native hover/focus chrome remains capability-driven. Lack of hover on touch-only platforms must not
fail the gate, and Studio must not add artificial focusability or authored-component handlers.
