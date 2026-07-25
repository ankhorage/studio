# Studio Selection Native Controller Validation

## Result

Status: **NO-GO**

This branch continued issue #156 after the focused per-node `Pressable` boundary failed in
`4d60042` and the web-only edit-canvas renderer spike failed in `f2b8e2f`.

No production implementation was retained. This document records the native feasibility evidence
only. No implementation PR should be opened from this result, and this does not fix issue #156.

## Branch

```text
issue-156/native-selection-controller-feasibility
```

The branch was created from current `origin/main`, not from either historical evidence branch.

## Unchanged Baseline

Before native feasibility work, the unchanged generated Expo web smoke was executed three
consecutive times:

```bash
ANKH_STUDIO_ADMIN_WEB_SMOKE=1 bun test src/host/generatedAdminExpoWeb.smoke.test.ts
ANKH_STUDIO_ADMIN_WEB_SMOKE=1 bun test src/host/generatedAdminExpoWeb.smoke.test.ts
ANKH_STUDIO_ADMIN_WEB_SMOKE=1 bun test src/host/generatedAdminExpoWeb.smoke.test.ts
```

Results:

- pass 1: 1 pass, 20 assertions, generated app hydrated
- pass 2: 1 pass, 20 assertions, generated app hydrated
- pass 3: 1 pass, 20 assertions, generated app hydrated

This confirmed PR #165's generated Expo web smoke repair was still healthy before native work.

## Prior Evidence

Relevant previous evidence:

- `4d60042 docs: record focused boundary executed no-go`
- `f2b8e2f docs: record edit canvas renderer spike no-go`

Those results established:

- The per-node interactive `Pressable` boundary is rejected because React Native Web renders it
  with `tabindex="0"`.
- The centralized web capture controller with inert Runtime markers and independent chrome passed
  the real generated Expo web smoke.
- The web spike was reverted only because it had no native hit-testing, native action suppression,
  or native chrome implementation.

The current native feasibility result does not reinterpret the passing web controller as rejected.

## Public Native APIs Inspected

The installed dependency graph includes:

- `react@19.1.0`
- `react-native@0.81.5`
- `react-native-gesture-handler@2.28.0`
- `react-native-reanimated@4.1.7`
- `expo@54.0.36`

Public React Native APIs available for this gate include:

- responder capture props: `onStartShouldSetResponderCapture`,
  `onMoveShouldSetResponderCapture`, `onResponderGrant`, `onResponderMove`,
  `onResponderRelease`, `onResponderTerminate`
- touch capture props: `onTouchStartCapture`, `onTouchMoveCapture`, `onTouchEndCapture`,
  `onTouchCancelCapture`
- pointer capture props on `View`
- `onLayout`
- host refs with `measure` / `measureInWindow`
- `collapsable` and `collapsableChildren`
- `pointerEvents`

Existing Studio DnD code exposes neutral drag payload/state helpers, but no existing
`activeCanvasDragNodeId` or equivalent generated-app selection cancellation contract.

## Candidate Architectures

### Candidate A: RN Touch-Capture Controller With Measurable Inert Markers

Shape tested:

- one root Edit-mode controller using public React Native touch capture
- per-node non-interactive `View` marker wrappers
- marker props: `collapsable={false}`, `pointerEvents="box-none"`, `onLayout`,
  `measureInWindow`, `testID`
- no per-node `Pressable` / `TouchableOpacity`
- no authored `onPress`, style, accessibility, focus, or ref injection
- hit testing from a geometry registry
- independent Studio chrome rendered outside authored props with `pointerEvents="none"`
- Preview represented by rendering children without markers

This was the first executable Android attempt because it directly tests whether Studio can own a
central selection gesture and geometry registry using only public RN APIs and Runtime's existing
generic `wrapNode` shape.

### Candidate B: Root Responder Claim With The Same Geometry Registry

Shape considered:

- one root Edit-mode controller returning `true` from
  `onStartShouldSetResponderCapture`
- selection on `onResponderRelease`
- drag threshold using responder movement
- the same public marker/measurement registry as Candidate A

This could suppress child `Pressable` actions earlier than a bubbling handler, but it would still
depend on the same geometry registry and would need to prove it does not break ScrollView and DnD
gesture ownership. It was not pursued after Candidate A produced a mandatory geometry failure that
Candidate B's responder ownership cannot fix.

### Candidate C: RNGH Root Gesture Recognizer With Geometry Registry

Shape considered:

- one root `GestureDetector` or explicit tap gesture
- failure on pan/scroll movement
- simultaneous or fail relationships with scroll and future DnD where possible
- independent overlay chrome
- the same node geometry registry

This remains dependent on reliable per-node bounds. It was not retained because the first executed
public marker registry could not measure absolute/overlapping Runtime nodes reliably, and adding a
new production dependency or private recognizer behavior is outside this gate.

## Android Environment

The available AVD was:

```text
Pixel_8_Pro_API_34-ext11
```

The emulator was started with:

```bash
emulator -avd Pixel_8_Pro_API_34-ext11 -no-snapshot -no-audio -no-window
```

Readiness checks:

```text
adb devices
List of devices attached
emulator-5554    device

adb shell getprop sys.boot_completed
1
```

## Disposable Probe

A disposable Expo/RN probe was created outside the repository at:

```text
/tmp/ankh-studio-native-selection-probe
```

The probe was not committed. It used the repo-installed `apps/studio` dependency graph through
symlinked package entries, not copied dependency directories.

The probe contained:

- nested parent and child Runtime-like nodes
- exposed parent surface
- authored Button-like `Pressable`
- authored Disclosure-like `Pressable`
- vertical `ScrollView`
- nested `ScrollView`
- drag-threshold logic
- absolute-positioned overlapping siblings
- flex and percentage layouts
- independent selection chrome
- Edit and Preview code paths

Build and install command:

```bash
CI=1 ./node_modules/.bin/expo run:android
```

Result:

- Android native build succeeded.
- APK installed and launched on `emulator-5554`.
- Metro bundled the probe app.
- Probe logs were emitted from the running Android app.

## Candidate A Event Sequence

The tested touch-capture controller used this sequence:

```text
onTouchStartCapture records start coordinate
onTouchMoveCapture marks dragged when movement exceeds threshold
onTouchEndCapture prevents default, stops propagation, resolves hit from measured bounds, selects once
onTouchCancelCapture clears the pending gesture
```

Executed Card tap after density adjustment:

```text
touch-start-capture x=224 y=383.3333435058594
selection nodeId=card selectionCount=3 source=touch-end-capture
```

Executed Button tap after density adjustment:

```text
touch-start-capture x=100 y=275
selection nodeId=button-text selectionCount=5 source=touch-end-capture
```

Executed Disclosure tap after density adjustment:

```text
touch-start-capture x=100 y=550
selection nodeId=disclosure selectionCount=6 source=touch-end-capture
```

No authored Button or Disclosure action was logged for those two targeted taps. A prior exposed
Panel tap sequence logged an authored `button` action before selecting `panel`, so action
suppression ordering was not cleanly proven before the geometry blocker was reached.

## Geometry Registry Evidence

Candidate A measured markers with `measureInWindow`. Representative executed Android bounds:

```text
stack: x=0 y=40.666656494140625 width=448 height=1574
inline: x=16 y=83.66665649414062 width=416 height=39
grid: x=16 y=130.66665649414062 width=416 height=64
text: x=16 y=202.66665649414062 width=416 height=35
button: x=16 y=245.6666717529297 width=416 height=59.00001525878906
button-text: x=28 y=265.66668701171875 width=392 height=19
panel: x=16 y=312.66668701171875 width=416 height=121.99996948242188
card: x=31 y=354.66668701171875 width=386 height=57
section-header: x=16 y=442.6666564941406 width=416 height=68
disclosure: x=16 y=518.6666870117188 width=416 height=61
percent: x=16 y=587.6666870117188 width=416 height=59
flex: x=16 y=654.6666870117188 width=416 height=80
absolute-parent: x=16 y=742.6666870117188 width=416 height=193.99993896484375
absolute-back: x=17 y=755.6666259765625 width=414 height=0
absolute-front: x=17 y=755.6666259765625 width=414 height=0
nested-scroll: x=16 y=944.6666259765625 width=416 height=156.0001220703125
nested-runtime-parent: x=16 y=1108.666748046875 width=416 height=122
nested-runtime-child: x=31 y=1150.666748046875 width=386 height=57
```

The absolute-positioned overlapping Runtime-like child nodes are mandatory fixtures for issue
#156. Both absolute child markers measured as zero-height wrappers at nearly the same coordinate:

```text
absolute-back: height=0
absolute-front: height=0
```

That is a hard feasibility failure for this marker architecture:

- The registry cannot know the visible bounds of either absolute child.
- The controller cannot reliably choose the visually topmost eligible Runtime node.
- z-index/elevation tie-breaking cannot be applied when the measured candidate bounds are wrong.
- The failure is caused by the public marker wrapper shape itself; the wrapper is measurable, but
  it is not layout-transparent for absolute-positioned children.
- Claiming the root responder earlier would not repair incorrect geometry.

## Deepest Hit Testing

Executed non-overlap hit testing partially worked:

- nested Card coordinate selected `card`
- exposed Panel coordinate selected `panel`
- Disclosure coordinate selected `disclosure`

However, deepest/visually-topmost hit testing is not proven because the required absolute
overlapping child nodes had invalid zero-height geometry. The requested tie-breaking strategy for
overlapping siblings, absolute positioning, and z-index/elevation cannot be implemented reliably
from these public measurements.

## Scroll, DnD, And Chrome

Normal vertical scrolling, nested scrolling, DnD arbitration, long press, multi-touch, cancellation,
and chrome alignment after scroll/reflow were not completed after the Android geometry failure.

Additional `adb input` interaction was blocked by the local approval system after the decisive
geometry evidence had already been collected. The gate does not depend on that blocker because the
executed Android geometry result is already a mandatory NO-GO condition.

The probe did render independent chrome with `pointerEvents="none"`, but chrome cannot be accepted
when the underlying registry cannot provide correct bounds for required Runtime nodes.

## Accessibility

The tested marker shape used inert `View` components with no accessibility role, label, selected
state, focus props, or per-node interactive wrapper. Android accessibility hierarchy inspection was
not completed after the geometry failure. No accessibility neutrality claim is made.

## iOS

Available iOS simulators were listed successfully, including iOS 18.0, 18.5, and 26.2 devices.

iOS boot/install/run was not attempted because Android reached a mandatory NO-GO first. The result
does not infer iOS correctness from Android.

## Outcome

Outcome: **NO-GO**

The tested public-API-only native path cannot satisfy issue #156. A Studio-owned `wrapNode`
measurement wrapper using public React Native `View` refs and `measureInWindow` is measurable for
many ordinary nodes, but it is not layout-transparent and does not provide reliable bounds for
absolute-positioned overlapping Runtime nodes. Therefore the controller cannot implement required
deepest/visually-topmost hit testing or reliable independent chrome.

No production or test implementation changes were retained. The next architecture cannot depend on
per-node native wrapper measurement through the existing generic `wrapNode` hook alone. It needs a
different Studio-owned edit-mode renderer/measurement strategy, or an explicitly approved smallest
generic Runtime/platform extension if Studio cannot observe authored host geometry non-invasively
from public APIs inside this repository boundary.
