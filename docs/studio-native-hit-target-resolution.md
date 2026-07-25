# Studio Native Hit Target Resolution RFC

## Previous Evidence Summary

Three executed evidence passes and one RFC established:

- Focused per-node `Pressable` boundary is invalid because React Native Web renders `Pressable` with `tabindex="0"`.
- Centralized web capture controller with inert node markers and independent chrome satisfies web acceptance checks.
- Native controller with wrapper measurement partially supports selection, but wrapper geometry is unreliable for absolute-positioned overlapping nodes (`height=0` measured).
- Host-geometry RFC proposed a generic `RuntimeNodeObserver`, but that contract alone does not solve composite Runtime nodes without forwarded refs, absolute/overlapping visual hit resolution, or complete #156 selection behavior.

## Why Global Geometry Hit Testing Was Reconsidered

The previous native spike measured every Runtime node and performed custom rectangle overlap resolution. This was rejected because:

1. Measuring every node for every touch is expensive and scales linearly with tree size.
2. Rectangle-based overlap resolution cannot reliably reconstruct visual stacking order without z-index/elevation state that is not exposed through public APIs.
3. Scroll containers and transforms invalidate stale rectangles.
4. The native platform ALREADY performs exact hit testing at the native view level. Reimplementing this decision in JS is redundant and lossy.

## Actual `nativeEvent.target` Findings

### Source-Level Analysis (React Native 0.81.5)

`Libraries/Renderer/implementations/ReactNativeRenderer-prod.js` lines 1330-1361 show the `receiveTouches` bridge:

```js
receiveTouches: function (eventTopLevelType, touches, changedIndices) {
  ...
  for (changedIndices = 0; changedIndices < JSCompiler_temp.length; changedIndices++) {
    i = JSCompiler_temp[changedIndices];
    i.changedTouches = JSCompiler_temp;
    i.touches = touches;
    index$4 = null;
    var target = i.target;
    null === target || void 0 === target || 1 > target || (index$4 = target);
    _receiveRootNodeIDEvent(index$4, eventTopLevelType, i);
  }
}
```

`nativeEvent.target` is a native view tag (`number`) provided by the platform. It is converted to a React fiber tag by `_receiveRootNodeIDEvent` (line 1280), which looks up the fiber instance via `getInstanceFromTag(rootNodeID)`.

`Libraries/Types/CoreEventTypes.d.ts` declares:

```ts
export interface NativeTouchEvent {
  ...
  target: string;
}
```

The runtime treats it as a numeric tag; the TypeScript declaration is loosely typed.

### Event Propagation Order

`traverseTwoPhase` (lines 1121-1132) implements capture then bubble:

```js
function traverseTwoPhase(inst, fn, arg, skipBubbling) {
  for (var path = []; inst;) {
    path.push(inst);
    do inst = inst.return;
    while (inst && 5 !== inst.tag);
    inst = inst ? inst : null;
  }
  for (inst = path.length; 0 < inst--;) fn(path[inst], 'captured', arg);
  if (skipBubbling) fn(path[0], 'bubbled', arg);
  else for (inst = 0; inst < path.length; inst++) fn(path[inst], 'bubbled', arg);
}
```

Capture listeners fire root-to-target before bubble listeners fire target-to-root.

### Responder Plugin Order

Event plugin order (line 1164):

```js
eventPluginOrder = ['ResponderEventPlugin', 'ReactNativeBridgeEventPlugin'];
```

`ResponderEventPlugin` runs BEFORE `ReactNativeBridgeEventPlugin`. Responder negotiation (`onStartShouldSetResponder`, `onMoveShouldSetResponder`) executes before React synthetic touch events are created and dispatched.

### Responder Grant Mechanics

Lines 760-813 of `ResponderEventPlugin` show that for `topTouchStart`, the plugin:

1. Walks from current responder and target to find common ancestor.
2. If target is not under current responder, allows transfer.
3. Calls `accumulateTwoPhaseDispatchesSingle` for `onStartShouldSetResponder`.
4. First listener returning `true` becomes the new responder.
5. If current responder exists, sends `responderTerminationRequest` to it.
6. If accepted, sends `responderTerminate` to old responder and `responderGrant` to new responder.
7. Otherwise sends `responderReject` to new responder.

### Pressable Action Invocation Order

`Pressability._performTransitionSideEffects` (lines 705-763) shows:

```js
if (isPressInSignal(prevState) && signal === 'RESPONDER_RELEASE') {
  ...
  const {onLongPress, onPress, android_disableSound} = this._config;
  if (onPress != null) {
    const isPressCanceledByLongPress = ...;
    if (!isPressCanceledByLongPress) {
      onPress(event);
    }
  }
}
```

`onPress` fires during `onResponderRelease` processing, AFTER the responder has been granted.

## Candidate Comparison

### Candidate A: Native Target Handle Registry

Register actual native host handles with owning Runtime node IDs. At touch capture time:

```text
nativeEvent.target
→ registered host handle
→ Runtime node ID
```

Source analysis shows this is THEORETICALLY viable. `nativeEvent.target` is available during capture. A registry mapping native tags to Runtime node IDs can be populated by Runtime exposing host refs when components accept them.

**Blockers**:

- React Native does NOT expose a public reverse lookup from native tag to React fiber/component.
- Runtime currently does not track native instances.
- Composite components without `forwardRef` do not expose host refs, so they cannot register native tags.

**Verdict**: Requires the host-ref observer proposed in the host-geometry RFC. Not standalone.

### Candidate B: Native Target Ancestor Ownership

Determine whether a native target handle can be resolved to a nearest registered Runtime-node host ancestor through public APIs.

**Finding**: Public APIs do NOT expose native ancestor traversal. `findNodeHandle` resolves component → tag, not tag → component. The renderer's `getInstanceFromTag` is private. React Native Web's `NativeDOM` module (`compareDocumentPosition`, `getParentNode`) exists only for web and is private.

**Verdict**: Not possible with public APIs alone.

### Candidate C: Runtime-Node Ownership Context

Evaluate whether Runtime could generically provide a current node-ownership context that platform host primitives or adapters may consume.

**Finding**: Runtime already renders each manifest node as `<Component ref={captureRef} {...props}>{children}</Component>`. If Runtime exposes a callback when `captureRef` is populated, an external consumer can build `nativeTag → RuntimeNodeId`. This is identical to the `RuntimeNodeObserver` proposal.

**Burden assessment**:

- Runtime: must invoke observer when host refs become available (or null).
- Platform runtime: optional measurement implementations.
- Surface primitives: no changes required.
- ZORA components: no changes required unless they want to participate (forwarding refs).
- Third-party components: participate naturally if they use `forwardRef` or native primitives.

**Verdict**: Same primitive as Option E from the host-geometry RFC. Remains the correct ownership boundary.

### Candidate D: Event-Path Capture Without Geometry

Determine whether non-interactive per-node capture participation can produce a native event path.

**Finding**: React Native DOES support capture/bubble phases (`traverseTwoPhase`). A root View with `onTouchStartCapture` receives the event before child handlers. However:

1. If the root claims responder via `onStartShouldSetResponderCapture: () => true`, it STOPS all descendant `onStartShouldSetResponder` from firing. Scroll views, draggable items, and nested responders never receive touches. This breaks scrolling and DnD.
2. If the root uses `onTouchStartCapture` WITHOUT claiming responder, the child still receives responder normally and `onPress` fires before the root can suppress it. `stopPropagation()` on a capture event prevents further React listeners on the SAME event type, but the responder system has ALREADY negotiated responder before bridge event listeners run.
3. React Native's pressability system uses responder events, NOT touch capture events. `Pressable` calls `onPress` from `_performTransitionSideEffects` during `onResponderRelease` (line 518), which is a direct responder event dispatch, not a synthetic touch event.

**Verdict**: A non-interactive root capture CAN observe the touch target but CANNOT suppress authored Pressable behavior without breaking scrolling. Not viable as a standalone action-suppression mechanism.

## Disposable Android Probe

An Expo/React Native probe was scaffolded outside the repository at `/tmp/ankhorge-hit-target-probe` matching the repository dependency graph (Expo SDK 54, React 19.1.0, React Native 0.81.5). The probe included:

- Nested Panel/Card hierarchy
- Authored Pressable Button with `onPress`
- Disclosure-like toggle
- Absolute overlapping back/front nodes
- ScrollView
- Root `onTouchStartCapture` logger

**Limitation**: The Android emulator (`Pixel_8_Pro_API_34-ext11`) was started and booted to `adb device` state. `npx expo run:android` successfully built the debug APK and installed it. However, Metro bundling failed at runtime with `Unable to resolve "expo-linking"` due to the standalone probe's module resolution not matching the repository's monorepo workspace layout. The probe was deleted; no behavior was validated on physical hardware.

**Consequence**: Results below are derived from React Native 0.81.5 INSTALLED SOURCE CODE analysis, not from emulator execution. Physical device validation is required before any implementation.

## Source-Level Event Ordering Analysis

Based on React Native 0.81.5 installed source:

### Button Edit Mode

Without wrapper mutation:

1. Native touch hits Pressable's native View.
2. `receiveTouches` delivers event to target fiber tag.
3. `ResponderEventPlugin` runs first:
   - Traverses path for `onStartShouldSetResponder` capture/bubble.
   - `Pressable.onStartShouldSetResponder` returns `true` (unless disabled).
   - If root View also returns `true` in capture, root wins because capture runs first.
   - Root becomes responder; child receives `responderReject`.
4. If root does NOT claim responder:
   - `Pressable` becomes responder, gets `onResponderGrant`.
   - Pressability state machine starts.
   - `disableActions: true` replaces authored `onPress` with `noopRuntimeActionHandler` IF `onPress` is an action binding.
   - If `onPress` is a raw callback (not action-shaped), `disableActions` sets it to `undefined`.
5. Bridge event plugin creates synthetic touch events.
6. `onTouchStartCapture` on root fires (if root exists in path).
7. `onTouchStart` on Pressable fires.
8. `Pressable.onResponderMove` tracks touch.
9. `Pressable.onResponderRelease` fires.
10. `_performTransitionSideEffects` calls `onPress` (if not suppressed by step 4).

**Finding**: A root capture CAN observe the target but CANNOT suppress Pressable's `onPress` without stealing responder. `disableActions` suppresses action-shaped `onPress` props but not raw callbacks.

### Disclosure Edit Mode

A DisclosureSection component typically manages internal expand/collapse state via React `useState` or similar. The toggle handler is internal to the component and does NOT flow through Runtime's action system.

**Finding**: `disableActions: true` does NOT suppress DisclosureSection's internal state toggle. The component-local `onPress` (or equivalent) is neither an action shape nor passed through `wrapRuntimeActionProps` if it is implemented inside the component body.

### Preview Mode

`disableActions: false` or omitted:

- Authored action bindings execute normally.
- Root capture does not claim responder (if implemented).
- Child Pressable/Disclosure behaves as authored.

## Scroll and Drag Arbitration

### Scroll Arbitration

If a root View claims responder via `onStartShouldSetResponderCapture: () => true`:

- ScrollView's `onStartShouldSetResponder` is never called.
- ScrollView never becomes responder.
- Scrolling is broken.

If root uses `onTouchStartCapture` without claiming responder:

- ScrollView becomes responder normally.
- Scrolling works.
- But root cannot suppress child actions.

**Finding**: There is no public mechanism to simultaneously observe ALL touch targets AND preserve normal scroll behavior without a global gesture controller that explicitly re-releases responder to scrollable areas. Such a controller requires knowing which areas are scrollable, which requires measurement or authored metadata.

### Drag Arbitration

React Native Gesture Handler (RNGH) v2 operates through native gesture recognizers, not through React's responder system for basic taps. RNGH's `TapGestureHandler` and `PanGestureHandler` attach native gesture detectors. They are independent of React's responder system.

**Finding**: A root responder claim does NOT necessarily break RNGH-based drag. RNGH gestures run on the native thread and can compete with JS responder. However, RNGH integration with Runtime action/data binding would need separate investigation.

## Selected-Node-Only Measurement

Source analysis confirm measurement primitives are available for selected-node chrome:

- **Web**: `HTMLElement.getBoundingClientRect()` on native ref.
- **Native**: `nativeRef.measure(callback)` returns `x, y, width, height, pageX, pageY`.

For Runtime nodes that accept refs (View, Text, Image, Pressable, forwardRef components), the host ref is measurable. For composite components without `forwardRef`, `hostRef` is `null`.

### Chrome Sources for Selected Node

1. **Actual native host target**: If the selected node's native view was the touch target, `nativeEvent.target` is its native tag. `findNodeHandle` and `UIManager.measure` can measure it.
2. **All directly owned hosts**: If the selected Runtime node rendered multiple host roots (fragment, conditional multiple roots), each measurable host can be measured.
3. **Canonical host root**: If the component renders a single primary host (e.g., Pressable's internal View), that single host represents the node.
4. **Union for multi-root nodes**: For fragments with multiple measurable children, union bounds.

### Measured Fixtures

- **Card**: If Card is a View wrapper, measurable via ref.
- **Button**: Pressable exposes ref via forwardRef; measurable.
- **Disclosure**: If Disclosure wraps content in a View without forwardRef, `hostRef` is null; measurement incomplete.
- **Absolute front/back**: Both measurable if they are native primitives or forwardRef.
- **Multi-root fragment**: Each measurable child can be measured; bounds unioned.

## Accessibility Neutrality

Source analysis of `View.js` (lines 119-124, 186-203) shows:

- A plain `View` does NOT add accessible semantics unless explicitly configured.
- `Pressable` sets `focusable: true` and `accessible: true` by default (lines 245-251 in `Pressable.js`).
- `onTouchStartCapture` on a `View` does NOT add accessibility nodes.
- `onStartShouldSetResponderCapture` does NOT add accessibility nodes.

If Studio adds selection chrome as an independent overlay rendered OUTSIDE the Runtime tree (as proven acceptable in the edit-canvas-renderer spike), the authored accessibility tree is unmodified.

**Finding**: Root touch capture on a non-interactive `View` does not introduce extra accessible targets, content descriptions, or focusability.

## Exact Missing Generic Capability

Native hit-target resolution is PARTIALLY feasible today. The exact missing generic capability is:

**`RuntimeNodeObserver`** (as proposed in `docs/studio-rendered-node-observation-rfc.md`)

This callback provides `nodeId`, `hostRef`, and `platform` whenever a Runtime node's rendered host instance becomes available. It enables a `nativeTag → RuntimeNodeId` registry.

**Why this is still required**:

- `nativeEvent.target` gives native tag identity.
- No public API maps native tag → React component.
- Runtime is the only place where host refs are available generically during render.

**What it does NOT solve**:

- Composite Runtime nodes without `forwardRef` or native primitive components return `hostRef === null`.
- No geometry is reported; only host identity.
- No paint ordering is reported; ordering is inferred from native platform hit-test result.

**What it DOES enable when combined with root touch capture**:

- Resolve native target tag to Runtime node ID for measurable nodes.
- Reuse the native platform's exact hit-test decision for absolute/overlapping nodes.
- Avoid measuring every node; measure only the selected node for chrome.

## Recommended Next Repository Owner

`@ankhorage/runtime` owns the `RuntimeNodeObserver` interface and invocation.

Studio cannot own it because that couples generic runtime observation to selection semantics, violating the convergence direction.

## Final Outcome

**PARTIAL HIT-TARGET RESULT**

Native target identity is usable, but one missing generic capability prevents complete Runtime-node resolution for the full #156 acceptance criteria:

- `nativeEvent.target` gives reliable native tag identity during capture.
- React Native source confirms capture events fire before child responder events.
- A root capture controller CAN observe the native target without destroying scroll IF it does NOT claim responder globally.
- `disableActions` suppresses action-shaped authored callbacks but NOT internal component-local state (DisclosureSection).
- The native platform's hit-test decision is ALREADY correct for absolute/overlapping nodes; no custom geometry hit test is needed once the tag-to-node mapping exists.
- Selected-node-only measurement is feasible for primitive and `forwardRef` components.

**Exact missing generic capability**: `RuntimeNodeObserver` on `RuntimeRendererConfig`, providing `nodeId`, `hostRef`, and `platform` for rendered nodes. Without it, Studio cannot build the `nativeTag → RuntimeNodeId` registry.

**Not-go areas**:

- No per-node interactive wrappers.
- No global geometry registry.
- No private Fabric or renderer internals.
- No authored component mutation.
- No changes to `@ankhorage/contracts`, ZORA, Surface, or platform packages.
