# Cooperative Interaction Contract Integration Validation

## Authoritative Prior RFC

RFC commit: `0245092c4c4dfdad1d81d22788a61e8815cae28b`
Prior outcome: `COMPONENT CONTRACT VALID, INTEGRATION INCOMPLETE`

The RFC established:

- `resolveNodeProps` can inject `interactionPolicy: 'enabled' | 'passive'` into explicitly known component types.
- `wrapNode` wraps rendered output in `RuntimeRenderer`.
- Component-owned suppression preserves private uncontrolled state.
- `disabled` props alter authored styling and expose disabled accessibility semantics.

This document updates the earlier provisional evidence with executed Android emulator results from the disposable probe.

## Initial Evidence State

The first version of this document was committed before manual execution and classified most integration items as `UNEXECUTED`. That provisional classification is superseded by the executed results recorded below.

## Corrected Package Ownership Matrix

Runtime node types in the Studio preview registry resolve through `ZORA_COMPONENT_REGISTRY` (`@ankhorage/zora` `src/registry.ts`). ZORA components are thin wrappers forwarding to Surface primitives. Third-party components may register their own implementations.

| Runtime node type                             | Public component    | Owning package | Wrapper package                                  | Internal interactive primitive          | Required passive behavior             | Where `interactionPolicy` must be accepted                           | Where it must be forwarded                      |
| --------------------------------------------- | ------------------- | -------------- | ------------------------------------------------ | --------------------------------------- | ------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------- |
| `Button`                                      | `Button`            | ZORA           | ZORA (`Button.tsx` → `SurfaceButton`)            | Surface `ButtonBase`                    | omit `onPress` / `onLongPress`        | ZORA `ButtonProps`, Surface `ButtonProps`, `ButtonBaseProps`         | ZORA forwards via `...props`                    |
| `IconButton`                                  | `IconButton`        | ZORA           | ZORA → Surface `ButtonBase`                      | Surface `ButtonBase`                    | omit `onPress` / `onLongPress`        | ZORA `IconButtonProps`, Surface `IconButtonProps`, `ButtonBaseProps` | ZORA forwards `...props` to `ButtonBase`        |
| `Card`                                        | `Card`              | ZORA           | ZORA → Surface `Card` → conditional `ButtonBase` | Surface `ButtonBase` (when `onPress`)   | omit `onPress`                        | ZORA `CardProps`, Surface `CardProps`, `ButtonBaseProps`             | ZORA/Surface conditional render path            |
| `DisclosureSection`                           | `DisclosureSection` | ZORA           | ZORA pattern                                     | ZORA-owned `Pressable` trigger          | guard `toggleOpen`                    | ZORA `DisclosureSectionProps`                                        | not forwarded; guard inside ZORA pattern        |
| `Tabs`                                        | `Tabs`              | ZORA           | ZORA → ZORA `Button` per tab                     | ZORA `Button` / Surface `ButtonBase`    | guard tab `onValueChange`             | ZORA `TabsProps`, ZORA `ButtonProps`, `ButtonBaseProps`              | ZORA `Tabs` passes to internal `Button`         |
| `Select`                                      | `Select`            | ZORA           | ZORA → `@react-native-picker/picker`             | external `Picker`                       | guard `onValueChange`                 | ZORA `SelectProps`                                                   | not forwarded; guard inside ZORA component      |
| `Input`                                       | `Input`             | ZORA           | ZORA → Surface `TextInput`                       | Surface `TextInput`                     | guard `onChangeText`                  | ZORA `InputProps`, Surface `TextInputProps`                          | ZORA forwards `...props` to `Surface.TextInput` |
| `Textarea`                                    | `Textarea`          | ZORA           | ZORA / Surface                                   | Surface `TextInput`                     | guard `onChangeText`                  | `TextareaProps`, Surface `TextInputProps`                            | forwarded via Surface prop chain                |
| `Modal`                                       | `Modal`             | ZORA           | ZORA → Surface `Modal`                           | Surface `Modal` (`Pressable` backdrop)  | omit backdrop `onPress` / `onDismiss` | ZORA `ModalProps`, Surface `ModalProps`                              | ZORA forwards `...props` to `Surface.Modal`     |
| `Drawer`                                      | `Drawer`            | ZORA           | ZORA → Surface `Drawer`                          | Surface `Drawer` (`Pressable` backdrop) | omit backdrop `onPress` / `onDismiss` | ZORA `DrawerProps`, Surface `DrawerProps`                            | ZORA forwards `...props` to `Surface.Drawer`    |
| `ScrollArea`                                  | Surface only        | Surface        | None                                             | React Native `ScrollView`               | preserve native scroll                | Surface `ScrollAreaProps`                                            | not applicable                                  |
| `FormField` / `Switch` / `Checkbox` / `Radio` | Surface             | Surface        | None                                             | Surface `ButtonBase` / `Pressable`      | guard component activation            | Surface primitive types                                              | forwarded via Surface                           |

**Key correction from the RFC**: ZORA changes ARE required. The RFC incorrectly stated `ZORA changes required: none`. Because Studio renders ZORA-registered components via Runtime, and ZORA components contain authored interaction logic (e.g., `DisclosureSection.toggleOpen`, `Tabs` tab `onValueChange`, `Select` `onValueChange`) or rely on Surface components whose TypeScript contracts do not currently include `interactionPolicy`, both Surface and ZORA must opt in.

## Corrected Third-Party Opt-In Model

Third-party participation requires all three of the following, not merely accepting a prop:

1. **Component implementation**: accepts `interactionPolicy?: 'enabled' | 'passive'` and enforces it by suppressing private activation, editing, and manipulation callbacks while preserving authored visual representation.
2. **Runtime registration**: the component is registered under a Runtime node type in `ComponentRegistry`.
3. **Capability declaration**: Studio's `resolveNodeProps` resolver includes that node type in an explicit allowlist.

No reflection or capability inference is used. Unknown components receive no policy prop and retain authored behavior.

## Exact Runtime Path

Installed source: `@ankhorage/runtime` `0.3.0`

```text
RuntimeRendererConfigProvider (context merge)
  ↓
RuntimeRenderer
  ↓
resolveRuntimeNodeProps({ node, props, resolveNodeProps })
  ↓
wrapRuntimeActionProps({ props, disableActions, ... })
  ↓
wrapRuntimeEventProps({ props, dataBindings, disableActions, ... })
  ↓
Component render with propsWithEvents
  ↓
wrapNode({ node, rendered })
  ↓
RuntimeRendererConfigProvider (explicit config propagation to children)
```

The probe injects policy in `resolveNodeProps`, which runs before action wrapping. `wrapNode` is used for touch-recording markers.

## Exact Policy Delivery

Policy name: `interactionPolicy`
Shape: `'enabled' | 'passive'`
Semantics:

- `enabled`: normal authored application behavior.
- `passive`: render the same authored representation, but suppress direct authored user activation, value editing, component-local toggles, long press, and authored manipulation gestures; preserve structural scrolling and layout.

In the probe, `resolveNodeProps` injects policy only for types declared in `PASSIVE_CAPABLE_TYPES`:

```ts
const passiveCapableNodeTypes = new Set([
  'CooperativeButton',
  'CooperativeDisclosure',
  'CooperativeInput',
  'CooperativeLongPress',
  'CooperativeDrag',
]);

return {
  ...props,
  interactionPolicy: mode === 'edit' ? 'passive' : 'enabled',
};
```

## Mode-Switch Implementation

The probe uses a deterministic Edit/Preview switch driven by React state (`mode`). The switch updates `resolveNodeProps` and `disableActions` via `makeConfig(mode, ...)`, which is passed to `RuntimeRendererConfigProvider`. Because the provider uses React context, the config change updates the existing Runtime tree without remounting it.

Evidence:

- Stable React keys (`child.id` for each `RuntimeRenderer` child)
- Stable component identity (no conditional replacement of `RuntimeRenderer`)
- Mount/unmount logs (`[COMPONENT_MOUNT]` / `[COMPONENT_UNMOUNT]`) show no remount on mode toggle
- `[MODE_CHANGE]` / `[CONTRACT_POLICY]` logs confirm policy transition

The runtime tree is created inside `ProbeScreen` through `useMemo(() => createUiNode(...), [])` so the authored Button callback can reference `setActionCount` while preserving stable node identity across mode changes.

## Selected Marker/Tap Architecture

### Candidate A: passive touch-path observation

Rejected. React Native does not expose reliable capture-phase touch observation that survives inner `Pressable` responder ownership. Parent `View` touch handlers may not fire when a child `Pressable` consumes the gesture.

### Candidate B: root RNGH Tap for commitment

Selected. A root-level `Gesture.Tap()` from `react-native-gesture-handler` distinguishes stationary taps from movement. Per-node `Marker` wrappers record the deepest touched node on `onTouchStart`. The root tap commits the deepest recorded node only when the gesture succeeds (short duration, limited movement). On movement, the tap fails and ScrollView native gestures proceed unimpeded.

The probe implements this with:

- Per-node `Marker` (`wrapNode`) emitting `[MARKER-RECORD]` on `onTouchStart`
- Root `GestureDetector` with `Gesture.Tap().maxDuration(500)` emitting `[TAP-SELECT]`

Selection commitment is guarded by `mode === 'edit'`; Preview toggles do not commit Studio selection.

### Candidate C: public responder capture with delayed commitment

Rejected. Any wrapper that claims responder ownership risks blocking ScrollView gestures or interfering with inner native gestures.

## Rejected Integrations

- Global rectangle hit testing
- `RuntimeNodeObserver`
- Measuring all Runtime nodes
- Focusable per-node selection wrappers
- Global responder stealing
- `pointerEvents="none"` on canvas
- `disabled` as passive implementation
- External conversion of uncontrolled state to controlled
- Reflection-based prop injection

## Component Identity Evidence

Manually observed in Android emulator:

- Runtime node IDs remained stable across mode transitions.
- React keys remained stable.
- Mode changes did not replace the Runtime tree.
- No component remount was observed during Edit/Preview transitions.
- The `useMemo`-wrapped `rootNode` preserves identity while allowing authored callbacks to reference React state setters.

## Button Edit Result

**EXECUTED**: PASS — manually executed in Android emulator.

Observed behavior:

- Button is selectable in Edit.
- Studio selection occurs once for a stationary tap.
- Authored Button action does not execute.
- Action counter remains unchanged.
- Passive appearance remains visually enabled rather than disabled.

Relevant diagnostics:

- `[BUTTON_HANDLER]` records component-level Pressable activation.
- No `[BUTTON_ACTION]` in passive mode.
- No `[TAP-SELECT]` in Preview; Edit produces exactly one selection.

## Button Preview Result

**EXECUTED**: PASS — manually executed in Android emulator.

Observed behavior:

- Button label shows enabled mode.
- Authored Button action executes exactly once.
- Visible Action counter increments by exactly 1.
- Studio selection remains unchanged.
- No Preview `[TAP-SELECT]`.
- Runtime component identity remains stable.

Harness repair note: the initial probe defect was that the module-scoped `rootNode` supplied no Button `onPress` callback. This was repaired by constructing the Runtime tree through stable `useMemo(() => createUiNode(...), [])` inside `ProbeScreen`, with the authored callback:

```ts
onPress: () => {
  console.log('[BUTTON_ACTION]');
  setActionCount((count) => count + 1);
};
```

## Disclosure State-Preservation Result

**EXECUTED**: PASS — manually executed in Android emulator.

Verified transition:

1. Disclosure starts closed in Preview.
2. Tap opens it; authored toggle executes once.
3. Switch to Edit/passive without remount; Disclosure remains open.
4. Tap trigger in Edit: Runtime node is selected once.
5. Disclosure does not toggle in passive mode.
6. Return to Preview without remount; tap closes normally.

This confirms:

- private uncontrolled state is preserved
- no external controlled-state conversion
- component-owned passive suppression works
- authored disclosure behavior is restored in Preview

## Input Edit Result

**EXECUTED**: PASS — manually executed in Android emulator.

Observed behavior:

- Input node can be selected in Edit.
- Raw native text events may be emitted.
- Component-owned guard prevents accepted value mutation.
- Visible value remains unchanged.
- No disabled visual styling is applied.

Distinction:

- raw native input event: may occur
- accepted component value change: does not occur in Edit

## Input Preview Result

**EXECUTED**: PASS — manually executed in Android emulator.

Observed behavior:

- typing changes the visible value
- accepted input callback executes
- no Studio selection is committed
- component identity remains stable

## Stationary Runtime-Node Selection

**EXECUTED**: PASS — manually executed in Android emulator.

Architecture:

```text
per-node touch recording through wrapNode
+
root RNGH stationary Tap commitment
```

Observed behavior:

- stationary Edit tap selects the intended Runtime node
- selection commits once
- Preview does not commit Studio selection

## Movement Cancellation

**EXECUTED**: PASS — manually executed in Android emulator.

Observed behavior:

- movement does not commit a stationary-tap selection
- stale touched-node state does not cause a later incorrect selection
- subsequent stationary taps select the current intended node

## Runtime ScrollView Result

**EXECUTED**: PASS — manually executed in Android emulator.

The Runtime-rendered white `ScrollView` scrolls normally in both Edit and Preview. Scroll movement does not commit selection.

## Nested Runtime ScrollView Result

**EXECUTED**: PASS — manually executed in Android emulator.

The nested green `ScrollView` inside the Runtime tree scrolls normally. Inner scrolling remains functional and does not commit selection.

## Plain Control ScrollView Result

**EXECUTED**: PASS — manually executed in Android emulator.

The `Plain control ScrollView` outside Runtime and outside the Studio tap-selection wrapper scrolls normally. This fixture proves scrolling is not broken by the root gesture architecture.

## Structural Scrolling with Studio Tap Selection

**EXECUTED**: PASS — manually executed in Android emulator.

Scrolling continues to work with Studio tap selection enabled. Movement does not commit a selection after scroll release.

## Long-Press Edit Result

**EXECUTED**: PASS — manually executed in Android emulator.

Observed behavior:

- authored long-press behavior is suppressed
- no normal authored tap action is triggered
- no double activation occurs

Selection side effect during Edit long press: not separately recorded.

## Long-Press Preview Result

**EXECUTED**: PASS — manually executed in Android emulator.

Observed behavior:

- authored long press executes normally
- normal tap action does not also execute
- Studio selection does not occur

## Authored Drag Edit Result

**EXECUTED**: PASS — manually executed in Android emulator.

Observed behavior:

- purple object does not move
- authored drag is suppressed
- passive mode does not execute drag behavior
- stationary Edit tap may still select the Runtime drag node

## Authored Drag Preview Result

**EXECUTED**: PASS — manually executed in Android emulator.

Observed behavior:

- purple draggable fixture moves
- authored drag behavior is active
- enabled-mode drag restoration works

## Authored Appearance

**EXECUTED**: PASS by manual visual inspection**

Observed behavior:

- no disabled styling
- controls remain visually enabled
- dimensions and layout remain stable
- Button, Disclosure, Input, and drag fixture do not visibly change solely because of passive policy

This is manual visual inspection, not a pixel-perfect screenshot comparison.

## UIAutomator Metadata

**EXECUTED**: NOT EXECUTED**

UIAutomator has not been run after the final probe repairs. Do not infer UIAutomator results from visual inspection.

## TalkBack Status

**EXECUTED**: NOT EXECUTED**

TalkBack was not enabled or manually observed. Accessibility semantics for the cooperative contract remain separately pending.

## Supported Harness Controls

The repaired probe exposes deterministic controls:

- Safe-area-aware header
- Edit/Preview mode switch
- Studio tap-selection ON/OFF switch
- Compact diagnostics showing selected node, action counters, scroll offsets
- Cooperative Runtime fixtures
- Runtime ScrollView, nested Runtime ScrollView, and plain control ScrollView

## Unsupported-Component Fallback

Selected fallback: **unsupported components retain authored behavior, and Studio must visibly mark them unsupported.**

Justification: silently passing `interactionPolicy` to unaware components is undefined behavior. Components without explicit capability declaration and component-side enforcement must not enter passive suppression. Studio must maintain an explicit allowlist and communicate unsupported status rather than silently failing.

## Required Runtime Changes

**No Runtime change required.**

The existing `resolveNodeProps` extension point delivers policy before action wrapping. `wrapNode` handles marker integration. No public API change is needed.

## Required Surface Changes

Surface primitives must accept `interactionPolicy?: 'enabled' | 'passive'` and enforce it at the primitive level:

- `ButtonBaseProps` must accept `interactionPolicy`. In passive mode, `onPress` and `onLongPress` must be conditionally `undefined` instead of relying on `disabled`.
- `TextInputProps` must accept `interactionPolicy`. In passive mode, `editable` must remain `false` and `onChangeText` must be guarded so native keyboard delivery cannot mutate application state.
- `ScrollAreaProps` does not require policy acceptance; native scroll behavior must remain functional. Studio must not attempt to suppress structural scrolling through component props.
- Overlay primitives (`Modal`, `Drawer`) must guard backdrop `onPress`/`onDismiss` in passive mode.

## Required ZORA Changes

ZORA component types must accept `interactionPolicy` where their Surface counterparts or internal authored logic require it:

- `ButtonProps`, `IconButtonProps`: extend Surface types to allow `interactionPolicy`.
- `CardProps`: extend to allow `interactionPolicy` when `onPress` is present.
- `DisclosureSectionProps`: accept `interactionPolicy` and guard `toggleOpen`.
- `TabsProps`: accept `interactionPolicy` and guard per-tab activation.
- `SelectProps`: accept `interactionPolicy` and guard `onValueChange`.
- `InputProps`, `TextareaProps`: extend Surface forwarding types to allow `interactionPolicy`.
- `ModalProps`, `DrawerProps`: extend Surface forwarding types to allow `interactionPolicy`.

Because ZORA components are thin wrappers, adding `interactionPolicy` to Surface primitive types allows ZORA to forward the prop without expanding wrapper logic, except for components with authored interaction logic (`DisclosureSection`, `Select`, `Tabs`).

## Required Studio Changes

Studio must:

1. Supply a `resolveNodeProps` resolver that injects `interactionPolicy: 'passive'` into declared-capable component types during Edit mode.
2. Preserve authored `resolveNodeProps` via spread or `composeRuntimeNodePropsResolver`.
3. Compose with existing `disableActions`.
4. Switch to `'enabled'` in Preview mode.
5. Maintain an explicit allowlist of component types that support the contract.
6. Wrap Runtime output through `wrapNode` for touch-recording markers.
7. Guard root tap selection commitment with `mode === 'edit'`.
8. Visibly mark unsupported components when Edit mode would otherwise leave them interactive.

## RuntimeNodeObserver Status

`RuntimeNodeObserver` remains unnecessary. The marker selection model uses existing `wrapNode` and explicit touch recording; no node enumeration or measurement loop is required.

## Exact Final Outcome

**ANDROID CONTRACT INTEGRATION VALIDATED**

The Android integration validates the cooperative interaction contract.

The existing Runtime `resolveNodeProps` extension point can deliver `interactionPolicy: 'enabled' | 'passive'` to explicitly declared-capable Runtime node types without a Runtime public API change.

Cooperative components can suppress their own authored activation, editing, private state transitions, long press, and manipulation gestures while preserving component identity, private uncontrolled state, authored visual appearance, and structural scrolling.

Per-node touch recording combined with a root RNGH stationary-tap recognizer can commit Runtime-node selection in Edit while movement cancels selection and ScrollView gestures remain functional.

Preview restores normal authored interaction and does not commit Studio selection.

`RuntimeNodeObserver` remains unnecessary.

## Remaining Limitations

This validation does not establish:

- actual TalkBack speech behavior
- complete accessibility neutrality
- arbitrary unsupported third-party component safety
- automatic capability inference
- behavior on components that do not implement the policy
- web parity of every native gesture result

## Committed File

- `docs/cooperative-interaction-integration-validation.md`

## Package / Lockfile / Changeset Status

No package, lockfile, production source, or changeset changes were made. The only intended repository change is the validation evidence document.

## Branch

`issue-156/cooperative-interaction-integration-validation`
