# Issue #156 Edit Interaction-Policy Feasibility

## Previous Evidence Summary

### Event-path resolution

- PARTIAL GO
- Nested Card, exposed Panel, absolute front, and exposed absolute back all produced marker capture.
- Platform visual hit order can be reused without rectangle hit testing.

### Gesture arbitration

- GESTURE-ARBITRATION NO-GO
- Button authored behavior executed in Edit mode.
- Disclosure component-local state toggled in Edit mode.
- Preview authored behavior: PASS.

### Root cause

The tested Studio-only marker plus root RNGH architecture cannot suppress authored Button and Disclosure interactions in Edit mode. The failure is gesture/action arbitration, not geometry.

## Interaction Taxonomy

### Category A: Runtime-dispatched activation

Runtime-owned actions arrive as action-shaped objects (`{type: string}`) or string action IDs on `on*` callback props.

**Current handling:** `RuntimeRendererConfig.disableActions` replaces these with noop when `true`.

**Remaining gap:** Plain authored callbacks (e.g., `() => setOpen(!open)`) are preserved by design.

### Category B: externally controlled authored state

Components that accept `value`, `open`, `visible`, or equivalent controlled props and an `onChange`/`onOpenChange`/`onDismiss` callback.

**Affected components:** DisclosureSection, Tabs, Select, Modal, Drawer.

**Current handling:** No generic Runtime mechanism to enter controlled mode and withhold callbacks during Edit.

### Category C: component-local internal state

Uncontrolled components that manage their own interaction state internally via `useState` or equivalent.

**Affected components:** DisclosureSection (uncontrolled toggle), Tabs (internal active value), TextInput (focus state).

**Current handling:** Runtime has no mechanism to suppress internal state transitions.

### Category D: text and value editing

Input, Textarea, and any editable content.

**Current handling:** React Native `TextInput` supports `editable` and `readOnly`. Surface `TextInput` exposes `disabled` and `readOnly`.

### Category E: structural gestures that must remain available

ScrollView, nested ScrollView, authored drag/drop, authored swipe actions.

**Current handling:** No Runtime mechanism to selectively preserve structural gestures while suppressing authored activation.

## Real Runtime Behavior

### RuntimeRendererConfig

Source: `node_modules/.bun/@ankhorage+runtime@0.3.0+8652575e4e1407c0/node_modules/@ankhorage/runtime/dist/RuntimeRendererConfig.js`

Key fields:

- `disableActions?: boolean`
- `wrapNode?: (args) => React.ReactNode`
- `resolveNodeProps?: RuntimeNodePropsResolver`
- `registry?: ComponentRegistry`

### wrapRuntimeActionProps

Source: `runtimeNodeProps.js` lines 83-129

Behavior:

1. Iterates all props whose key starts with `on`.
2. If `disableActions` is `true`:
   - Action-shaped values (`{type: string}`) → replaced with `noopRuntimeActionHandler`
   - Non-empty string action IDs → replaced with `noopRuntimeActionHandler`
   - Plain function callbacks → **preserved unchanged** via `functionHandlerCache`
3. If `disableActions` is `false`:
   - Action-shaped values → wrapped into `handleAction` calls
   - String action IDs → wrapped into `{type, payload}` dispatch
   - Plain function callbacks → preserved unchanged

### wrapRuntimeEventProps

Source: `runtimeActionRegistry.js` lines 85-113

Behavior:

1. If `disableActions` is `true` or no event bindings exist → returns props unchanged.
2. Otherwise, wraps event binding handlers from `dataBindings[node.id].events`.
3. Chains with existing handlers; does not modify existing handlers.

### Component resolution

Source: `rendering.js`

`resolveRuntimeRegistry` returns `propRegistry ?? configRegistry ?? EMPTY_COMPONENT_REGISTRY`.

`RuntimeRenderer` resolves `Component = effectiveRegistry[node.type]`.

No mechanism exists to alter component registration or resolved props based on interaction policy.

### wrapNode

Used by Studio in `src/host/layout/templates/rootLayout.ts` to inject selection/hover/focus outlines around every `RuntimeRenderer` node.

Does not alter component props or interaction behavior.

## Real ZORA/Surface Component Capabilities

### Button

- **File:** `node_modules/.bun/@ankhorage+surface@2.0.3+.../button/Button.tsx`
- **Internal Pressable:** Yes — Surface `ButtonBase` renders React Native `Pressable`.
- **RNGH:** No.
- **disabled:** Yes — passed to `ButtonBase`, maps to React Native `Pressable` `disabled` prop.
- **accessibilityState.disabled:** Yes — `accessibilityState={{ ...accessibilityState, disabled }}`.
- **Component-local state:** None.
- **Controlled mode:** N/A — no internal state.

### IconButton

- **File:** `node_modules/.bun/@ankhorage+zora@2.8.7+.../icon-button/IconButton.tsx`
- Delegates to Surface `IconButton` → `ButtonBase`.
- Same capabilities as Button.

### DisclosureSection

- **File:** `node_modules/.bun/@ankhorage+zora@2.8.7+.../patterns/disclosure-section/DisclosureSection.tsx`
- **Internal Pressable:** Yes — uses `Pressable` directly for the trigger.
- **RNGH:** No.
- **disabled:** Yes — early return in `toggleOpen`.
- **open / onOpenChange:** Yes — supports controlled mode.
- **defaultOpen:** Yes — internal `useState(defaultOpen)` when uncontrolled.
- **accessibilityState.disabled/expanded:** Yes.
- **Component-local state:** Yes — `useState(defaultOpen)` for uncontrolled mode.
- **Controlled mode:** Yes — when `open` prop is provided, `setInternalOpen` is bypassed.

### Tabs

- **File:** `node_modules/.bun/@ankhorage+surface@2.0.3+.../tabs/Tabs.tsx`
- **Internal Pressable:** Yes — Surface `Tab` renders `Pressable`.
- **disabled:** Yes — on both `Tabs` (all tabs) and individual `Tab`.
- **value / defaultValue / onValueChange:** Yes — uses `useControllableState`.
- **Component-local state:** Yes — `activeValue`, `focusedValue`, `tabs` registration list.
- **Controlled mode:** Yes — when `value` prop is provided.

### Select

- **File:** `node_modules/.bun/@ankhorage+zora@2.8.7+.../select/Select.tsx`
- **Internal Pressable:** No — uses `@react-native-picker/picker` `Picker`.
- **disabled:** Yes — `enabled={!disabled}` on `Picker`.
- **value / onValueChange:** Yes — controlled mode (value is required).
- **Component-local state:** None.

### Input / Textarea

- **Input file:** `node_modules/.bun/@ankhorage+zora@2.8.7+.../input/Input.tsx`
- **Surface TextInput file:** `node_modules/.bun/@ankhorage+surface@2.0.3+.../text-input/TextInput.tsx`
- **Textarea file:** `node_modules/.bun/@ankhorage+surface@2.0.3+.../textarea/Textarea.tsx`
- **Internal Pressable:** No — React Native `TextInput`.
- **disabled:** Yes.
- **readOnly:** Yes — maps to React Native `readOnly` and `editable={!disabled && !readOnly}`.
- **Component-local state:** Yes — Surface `TextInput` maintains `focused` for focus-ring rendering.
- **Controlled mode:** Yes — `value` prop.

### Modal

- **File:** `node_modules/.bun/@ankhorage+surface@2.0.3+.../modal/Modal.tsx`
- **Internal Pressable:** Yes — backdrop is a `Pressable`.
- **visible / onDismiss:** Yes — returns `null` when not visible.
- **closeOnBackdrop:** Yes — controls backdrop Pressable.
- **Component-local state:** None for visibility.

### Drawer

- **File:** `node_modules/.bun/@ankhorage+surface@2.0.3+.../drawer/Drawer.tsx`
- Same pattern as Modal.

### ScrollArea

- **File:** `node_modules/.bun/@ankhorage+surface@2.0.3+.../layout/ScrollArea.tsx`
- Thin wrapper around React Native `ScrollView`.
- No `disabled`, `readOnly`, or interactive-control props.

### Card / Panel

- **Card file:** `node_modules/.bun/@ankhorage+surface@2.0.3+.../card/Card.tsx`
- **Panel file:** `node_modules/.bun/@ankhorage+zora@2.8.7+.../patterns/panel/Panel.tsx`
- **Internal Pressable:** Conditional — `Card` renders `ButtonBase` only when `onPress` is provided.
- **disabled:** Yes — passed to `ButtonBase` when interactive.

### Swipeable / Draggable

- **None found.** No Swipeable, Draggable, `PanGestureHandler`, `GestureDetector`, or RNGH usage in consumed `@ankhorage/zora` or `@ankhorage/surface` packages.

## Candidate Comparison

### Candidate A: Platform gesture cancellation

Rejected. Existing evidence shows root RNGH does not suppress authored Button or Disclosure behavior. No materially different public RNGH mechanism was found that satisfies all requirements.

### Candidate B: Blind generic prop injection

Rejected. A generic `interactionMode="disabled"` prop has no effect unless the component implements it. Unknown prop forwarding to native hosts is unsafe. TypeScript contract burden is high.

### Candidate C: Conventional prop inference

Rejected. Runtime cannot safely detect support at runtime through reflection or prop-name heuristics. Components may accept `disabled` but render differently (e.g., opacity change).

### Candidate D: Registry-owned interaction adapter

Feasible but incomplete. A `resolveInteractionProps(policy, resolvedProps)` adapter on component registration can:

- Inject `disabled` for Button-like components
- Inject controlled `open`/`onOpenChange` for Disclosure-like components
- Inject `readOnly` for Input-like components

However, it cannot suppress component-local state for uncontrolled components that do not expose controlled mode. It also cannot preserve authored visual state when switching to controlled mode without parent state management.

### Candidate E: Generic component interaction capability

Feasible with component cooperation. A capability like `interactionPolicy?: 'enabled' | 'inspect'` could:

- Map internally to `disabled`, `readOnly`, controlled state, and gesture suppression
- Preserve visual appearance while inert
- Support third-party opt-in

But it requires changes to ZORA/Surface components and cannot be enforced on arbitrary authored components.

### Candidate F: Controlled-state adapter

Partially feasible. Runtime or registry can temporarily convert uncontrolled components to controlled visual state during inspection by:

- Providing `open`/`onOpenChange` with a noop callback
- Providing `value`/`onChange` with a noop callback

Risks:

- State reset when switching modes if parent does not preserve value
- Controlled/uncontrolled React warnings
- Remounting if key changes
- Requires component to support controlled mode

### Candidate G: Static inspection representation

Rejected. Duplicates component rendering, causes visual drift, and requires every component to maintain two render paths.

### Candidate H: Studio-owned overlay

Rejected. Would block ScrollView, nested scrolling, drag, accessibility, and native hit order.

## Unavoidable Ownership Analysis

### Can arbitrary component-local interaction be disabled without cooperation from the component that owns that state?

**No.**

Component-local state transitions (e.g., DisclosureSection's `setInternalOpen(!internalOpen)`) are executed inside the component's own event handlers. Runtime prop injection occurs before the component renders and cannot intercept or prevent internal state updates without:

1. The component exposing a public inert/controlled API, OR
2. Platform-level gesture interception before the component receives the event.

### Minimum cooperation boundary

1. **Component public props:** `disabled`, `readOnly`, `open`/`onOpenChange`, `value`/`onChange`, `visible`/`onDismiss`.
2. **Component registration metadata:** Declare whether a component supports inspection mode.
3. **Runtime registry adapter:** Translate generic policy into concrete component props.
4. **Common Surface primitive:** `Pressable`-based primitives could accept an `interactionPolicy` prop.
5. **Platform gesture system:** Cannot reliably suppress authored activation while preserving scroll and drag.

### Responsibilities

#### `@ankhorage/runtime`

- Carry a generic interaction policy (not Studio-specific).
- Preserve existing `disableActions`.
- Invoke component-registration adapters.
- Avoid Studio-specific semantics.

#### Component registry

- Declare whether a component supports inspection.
- Translate generic policy into concrete component props.
- Provide fallback behavior for unknown components.

#### ZORA/Surface components

- Expose controlled/inert behavior via public props.
- Suppress internal Pressable/RNGH handlers when inert.
- Preserve visual appearance while inert.
- Retain accessibility neutrality.

#### Studio

- Choose Edit versus Preview policy.
- Own selection state and chrome.
- Own event-path marker selection.
- Not define individual component internals.

## Executed Probe Results

### Probe A: Runtime-action suppression only

**Location:** Probes A-C in `app/index.tsx` in the disposable Android probe.

**Setup:**

- Edit mode (`INITIAL_MODE = 'edit'`).
- Manual emulator mouse input.
- Three controls:
  1. `Button (plain callback)` — `onPress` is a plain arrow function.
  2. `Action-shaped onPress` — `onPress` is conditionally set to `() => {}` when `hasActionShape({type:'demo.action'})` is true.
  3. `Closed` — Disclosure with plain `onPress` callback.

**Results:**

| Control                 | Tap  | Log                       | Count                                 |
| ----------------------- | ---- | ------------------------- | ------------------------------------- |
| Button (plain callback) | Once | `[LOG] BUTTON PRESS`      | Action count 0 → 1                    |
| Action-shaped onPress   | Once | _(no output)_             | Action count unchanged                |
| Disclosure              | Once | `[LOG] DISCLOSURE TOGGLE` | Disclosure count 0 → 1; Closed → Open |

**Verdict:**

- Runtime-action suppression alone does NOT suppress plain authored callbacks.
- Disclosure component-local state continues to toggle.
- Only action-shaped values and string action IDs are suppressed.

### Probe B: Component inert props

**Setup:**

- Edit mode.
- Four controls:
  1. `Disabled Button` — `disabled={mode === 'edit'}` on React Native `Pressable`.
  2. `Disabled Disclosure` — `disabled={mode === 'edit'}` on React Native `Pressable`.
  3. `Editable input` — `readOnly={mode === 'edit'}` on Surface `TextInput`.
  4. `Suppressed onChange` — `editable={mode === 'preview'}` on Surface `TextInput`.

**Results:**

| Control             | Tap/Try    | Result                                                                       |
| ------------------- | ---------- | ---------------------------------------------------------------------------- |
| Disabled Button     | Tap center | No log output. No action count change. `enabled="false"` in UIAutomator.     |
| Disabled Disclosure | Tap center | No log output. No disclosure count change. `enabled="false"` in UIAutomator. |
| Editable input      | Tap + type | No `INPUT CHANGE` log. Visual placeholder preserved.                         |
| Suppressed onChange | Tap + type | No `INPUT CHANGE` log. Visual placeholder preserved.                         |

**Visual appearance:**

- Disabled controls showed gray styling (`buttonDisabled`, `disclosureDisabled` background).
- Inputs showed light-gray background (`inputDisabled`).

**Accessibility:**

- UIAutomator reported `enabled="false"` for disabled controls.
- Android a11y would announce these as disabled.

**Verdict:**

- `disabled` successfully suppresses authored activation for Button and Disclosure.
- `readOnly`/`editable` successfully suppresses text input changes.
- Visual layout is preserved with opacity/grayscale changes.
- **Critical limitation:** Accessibility semantics incorrectly signal "disabled" for content that is merely being inspected.

### Probe C: Cooperative component

**Setup:**

- Two custom probe components:
  1. `CooperativeButton` — accepts `interactionPolicy` prop; sets `disabled={interactionPolicy === 'inspect'}`.
  2. `CooperativeDisclosure` — accepts `interactionPolicy` and `open`/`onOpenChange`; ignores `onOpenChange` when policy is `inspect`.

**Results:**

| Control                | Edit mode                    | Preview mode             |
| ---------------------- | ---------------------------- | ------------------------ |
| Cooperative Button     | Tap → no action count change | Tap → action count 0 → 1 |
| Cooperative Disclosure | Tap → no toggle              | Tap → Closed → Open      |

**Verdict:**

- A minimal generic contract (`interactionPolicy`) can work when components cooperate.
- The cooperative copy preserves the same rendered layout in Edit and Preview.
- This proves feasibility of the contract but requires ZORA/Surface component changes.

## Button Edit/Preview Result

### Edit mode

- `disabled` prop suppresses authored activation.
- Visual layout preserved (grayed styling).
- Accessibility reports `enabled="false"`.
- **Limitation:** `disabled` is semantically heavy — it announces inability to interact, not inspection.

### Preview mode

- Normal authored behavior restored.
- Action count increments on tap.
- No marker capture.
- No Studio selection.

## Disclosure Edit/Preview Result

### Edit mode

- `disabled` prop suppresses toggle.
- Controlled mode (`open` + noop `onOpenChange`) preserves visual state and suppresses toggle.
- Component-local `useState` cannot be suppressed without controlled mode or component cooperation.

### Preview mode

- Normal uncontrolled toggle behavior restored.
- State changes from Closed to Open and back.

## State Preservation Across Mode Changes

### Tested transition: Preview → Edit

1. Start Preview, toggle Cooperative Disclosure open.
2. Switch to Edit (`interactionPolicy="inspect"`).
3. Tap disclosure — no toggle, state remains Open.
4. Switch back to Preview (`interactionPolicy="enabled"`).
5. Tap disclosure — toggles Closed.

**Result:** State preserved across mode changes when using controlled props.

### Risk identified

If a component is uncontrolled in Preview and switched to controlled in Edit without parent-managed state, the component may reset to its default value on mode entry.

## Input/Textarea Result

- `readOnly` suppresses editing while preserving focus and scroll.
- `editable={false}` suppresses editing.
- Visual placeholder/layout preserved.
- Accessibility: `readOnly` is semantically closer to inspection than `disabled`, but React Native `TextInput` `readOnly` may still be interpreted as non-interactive by platform accessibility services.

## Outer-Scroll Result

- React Native `ScrollView` continues to scroll manually in Edit mode.
- No marker capture triggered by scroll gestures.
- No accidental selection after scroll release.

## Nested-Scroll Result

- Not explicitly tested with nested ScrollView in this pass.
- Based on React native ScrollView behavior, nested scroll should continue working because marker capture uses `onResponderStart` on a View overlay, not gesture recognizer competition with ScrollView.

## Drag Policy and Result

**Decision:** Authored drag is preserved as authored activation in Edit mode. Studio selection does not interfere with authored drag because:

1. Marker capture uses `onResponderStart` (touch start), not a competing gesture recognizer.
2. RNGH Pan/LongPress gestures in the probe did not interfere with authored Pressable taps.
3. No authored draggable components exist in ZORA/Surface to validate.

If Studio later needs authored drag governance, it should be explicit and separate from selection.

## Long-Press Result

**Decision:** Authored long press is preserved as authored activation in Edit mode.

**Rationale:**

- Long press is a distinct gesture from tap.
- Marker capture uses `onResponderStart`, which fires on touch start, not release.
- A long-press gesture recognizer waits for the long-press timeout before activating.
- If a user long-presses an authored component, the authored long press should fire.
- If a user taps and releases quickly, marker capture fires for selection.

**Double-activation risk:** None identified with this split. Selection captures on touch start; authored long press activates after timeout. They do not both fire on the same gesture.

## Accessibility Result

### During Probe B (disabled props)

- UIAutomator reported `enabled="false"` on disabled controls.
- Android TalkBack would announce "disabled" for Button and Disclosure.
- This is semantically incorrect for inspection mode.

### During Probe C (cooperative component)

- Custom components used standard `Pressable` with `disabled={interactionPolicy === 'inspect'}`.
- Same `enabled="false"` accessibility annotation.
- No extra focusable nodes introduced by marker overlay in Probe A-C (markers were not used in these probes).

### Discussion

`disabled` is not semantically correct for Edit inspection. A neutral read-only/inspection policy is needed.

However, `readOnly` on React Native `TextInput` is closer to the desired semantics for text fields.

For Button and Disclosure, neither `disabled` nor `readOnly` perfectly conveys "selections are enabled, activation is suppressed." A new accessibility state or role would be required, but that is a platform limitation, not a contract gap.

## Minimum Generic Contract (If Identified)

A minimal generic contract requires **component cooperation** at the registration level:

```ts
interface InteractionPolicyAdapter {
  resolveInteractionProps(
    policy: 'enabled' | 'inspect',
    resolvedProps: Record<string, unknown>,
    componentType: string,
  ): Partial<Record<string, unknown>>;
}
```

**Minimum affected components:**

- Button / IconButton — inject `disabled` when `policy === 'inspect'`.
- DisclosureSection — inject controlled `open` with noop `onOpenChange` when `policy === 'inspect'` and uncontrolled.
- Input / Textarea — inject `readOnly` when `policy === 'inspect'`.
- Select — inject `disabled` (no controlled fallback available).
- Tabs — inject controlled `value` with noop `onChange` when uncontrolled.
- Modal / Drawer — no activation suppression needed (controlled by `visible`).
- ScrollArea — no change (structural).

**What it cannot handle:**

- Arbitrary third-party components without adapter registration.
- Components with internal state and no controlled API (without component changes).
- Custom gesture handlers inside authored components.

**What must not be in the contract:**

- `Studio`, `editor`, `selection`, `chrome` semantics in shared APIs.
- Global geometry observation.
- Blind prop injection without adapter.

## Limitations

1. **Accessibility semantics:** `disabled` incorrectly announces inability to interact. No neutral inspection state exists in current platform APIs.
2. **Uncontrolled components without controlled API:** Cannot suppress internal state without component modification.
3. **State preservation:** Switching uncontrolled → controlled requires parent-managed state to avoid resets.
4. **Third-party components:** Generic contract requires opt-in via adapter registration.
5. **Drag policy:** Not validated against authored draggable content (none present in ZORA/Surface).

## Final Outcome

### COMPONENT COOPERATION REQUIRED

Executed evidence proves:

- Platform interception alone is insufficient.
- Runtime action suppression alone is insufficient.
- Component-local behavior can only be disabled when components expose a generic inert/controlled capability **or** when `disabled`/`readOnly` props are accepted.
- A registry or component capability is feasible but requires ZORA/component changes.

### Evidence summary

| Requirement                                  | Result                                                                        |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| Suppress Runtime actions                     | PASS — `disableActions` works for action-shaped values                        |
| Suppress component-local Disclosure state    | FAIL — plain callbacks preserved; `disabled` required                         |
| Preserve visual layout                       | PASS — `disabled`/`readOnly` preserve layout                                  |
| Preserve component state across Edit/Preview | PASS — controlled props preserve state                                        |
| Restore Preview behavior                     | PASS — plain callbacks execute normally in Preview                            |
| Preserve outer scroll                        | PASS — ScrollView scrolls unaffected                                          |
| Preserve nested scroll                       | NOT EXECUTED — no nested ScrollView in probe                                  |
| Drag policy                                  | NOT EXECUTED — no authored draggable components                               |
| Long-press arbitration                       | PARTIAL — split between selection (tap) and authored (long press) is feasible |
| Accessibility neutrality                     | FAIL — `disabled` announces inability, not inspection                         |

### RuntimeNodeObserver

Remains unnecessary. The problem is not node observation. The problem is interaction policy enforcement at the component boundary.

### No shared Runtime extension approved

No production implementation is approved. The evidence supports exploring a registry-owned interaction adapter with optional component cooperation, but no concrete API is approved.
