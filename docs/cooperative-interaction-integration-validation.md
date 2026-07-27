# Cooperative Interaction Contract Integration Validation

## Authoritative Prior RFC

RFC commit: `0245092c4c4dfdad1d81d22788a61e8815cae28b`
Prior outcome: `COMPONENT CONTRACT VALID, INTEGRATION INCOMPLETE`

The RFC established:

- `resolveNodeProps` can inject `interactionPolicy: 'enabled' | 'passive'` into explicitly known component types.
- `wrapNode` wraps rendered output in `RuntimeRenderer`.
- Component-owned suppression preserves private uncontrolled state.
- `disabled` props alter authored styling and expose disabled accessibility semantics.

This validation re-evaluates the unexecuted integration items with corrected ownership findings and a real Android probe harness.

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
| `Textarea`                                    | `Textarea`          | ZORA           | ZORA / Surface                                   | Surface `TextInput`                     | guard `onChangeText`                  | ZORA `TextareaProps`, Surface `TextInputProps`                       | forwarded via Surface prop chain                |
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

## Selected Marker/Tap Architecture

### Candidate A: passive touch-path observation

Rejected. React Native does not expose reliable capture-phase touch observation that survives inner `Pressable` responder ownership. Parent `View` touch handlers may not fire when a child `Pressable` consumes the gesture.

### Candidate B: root RNGH Tap for commitment

Selected. A root-level `Gesture.Tap()` from `react-native-gesture-handler` distinguishes stationary taps from movement. Per-node `Marker` wrappers record the deepest touched node on `onTouchStart`. The root tap commits the deepest recorded node only when the gesture succeeds (short duration, limited movement). On movement, the tap fails and ScrollView native gestures proceed unimpeded.

The probe implements this with:

- Per-node `Marker` (`wrapNode`) emitting `[MARKER-RECORD]` on `onTouchStart`
- Root `GestureDetector` with `Gesture.Tap().maxDuration(500)` emitting `[TAP-SELECT]`

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

The probe confirms stable component identity across mode transitions:

- `[COMPONENT_MOUNT]` appears once per cooperative component at startup
- Mode toggles emit `[MODE_CHANGE]` and `[CONTRACT_POLICY]` but no `[COMPONENT_UNMOUNT]` or `[COMPONENT_MOUNT]`
- React keys remain bound to stable `node.id` values

## Button Edit Result

**EXECUTED**: No. This was not manually executed on the Android emulator in this pass.

**Expected behavior from probe design**:

- In passive/edit mode, `CooperativeButton` omits `onPress` handler.
- A stationary tap on the Button should commit selection of `button-node` via root RNGH Tap.
- `BUTTON_PRESS` should not execute.
- Authored styling (`backgroundColor: '#2196f3'`, `padding`, `borderRadius`) remains unchanged.

**UNEXECUTED** — requires manual emulator interaction.

## Button Preview Result

**EXECUTED**: No.

**Expected behavior**:

- In Preview/enabled mode, `CooperativeButton` restores `onPress`.
- A tap should execute `onPress` exactly once.
- No Studio selection should occur.

**UNEXECUTED** — requires manual emulator interaction.

## Disclosure State-Preservation Result

**EXECUTED**: No.

**Expected behavior**:

- Disclosure starts closed in Preview.
- Toggle opens it; `DISCLOSURE_TOGGLE` fires once.
- Switch to Edit/passive without remount; Disclosure remains open.
- Tap trigger in Edit: node selected once; `DISCLOSURE_TOGGLE` does not fire; Disclosure stays open.
- Return to Preview without remount; tap closes normally.

**UNEXECUTED** — requires manual emulator interaction.

## Input Result

**EXECUTED**: No.

**Expected behavior**:

- In Edit/passive: `CooperativeInput` sets `editable={false}` and `readOnly={true}` and guards `onChangeText`.
- A tap should select the input node.
- Keyboard input should not change the value.
- In Preview: typing changes the value once per keystroke; no Studio selection.

**UNEXECUTED** — requires manual emulator interaction. Note: the RFC noted that Android soft-keyboard input may bypass `readOnly` alone; the contract requires the component to guard its own `onChangeText` handler.

## Outer-Scroll Result

**EXECUTED**: No.

The probe contains an outer `ScrollView` outside the Runtime tree. A root RNGH Tap recognizer is intended to fail on movement, allowing the outer ScrollView to scroll. After a movement gesture, a stationary tap should select the deepest touched Runtime node.

**UNEXECUTED** — requires manual emulator interaction.

## Nested-Scroll Result

**EXECUTED**: No.

The probe contains a nested `ScrollView` inside the Runtime node tree. Inner scrolling should remain functional in both Edit and Preview. Stationary taps inside the inner area should select the deepest touched Runtime node. Scroll gestures should not commit selection.

**UNEXECUTED** — requires manual emulator interaction.

## Long-Press Result

**EXECUTED**: No.

**Expected behavior**:

- In Edit/passive: `CooperativeLongPress`omits `onPress` and `onLongPress`. Long press should execute no authored callback. Whether a long press selects the node depends on root RNGH Tap behavior; a stationary long touch that does not exceed tap gesture expectations may record the node but should not double-activate.
- In Preview: long press executes `LONG_PRESS` exactly once; no normal tap callback; no Studio selection.

**UNEXECUTED** — requires manual emulator interaction.

## Authored-Drag Result

**EXECUTED**: No.

`CooperativeDrag` in the probe demonstrates authored drag suppression by removing `onPress` in passive mode. Because the probe does not implement actual drag gesture bindings (no stateful position manipulation), authored drag result remains validated only at the component contract level.

**UNEXECUTED** — requires manual emulator interaction with a stateful authored-drag fixture.

## Movement-Versus-Selection Result

**EXECUTED**: No.

**Expected behavior**:

- Movement exceeding RNGH Tap `maxDuration`/distance cancels the root tap.
- The deepest node recorded by `Marker` during touch start is preserved but not committed.
- No selection occurs after scrolling.
- Stationary taps commit exactly once.

**UNEXECUTED** — requires manual emulator interaction.

## Authored Appearance Comparison

**EXECUTED**: Partially (probe styling inspection only; no pixel-level screenshot comparison was performed).

The probe uses identical style objects for passive and enabled states:

- Button: `backgroundColor`, `padding`, `borderRadius` are unchanged; `buttonPassive` only sets `opacity: 1`.
- Disclosure: identical colors, padding, border radius; `disclosurePassive` sets `opacity: 1`.
- Input: identical border, padding, font size; `inputPassive` sets `backgroundColor: '#fff'`.

No `disabled` styling is applied. `enabled` is not set to `false` anywhere in the probe.

## UIAutomator Metadata

**EXECUTED**: No.

UIAutomator has not been run in this pass.

## TalkBack Status

**EXECUTED**: No.

TalkBack was not enabled or manually observed. Accessibility semantics for the cooperative contract remain separately pending.

## Unsupported-Component Fallback

Selected fallback: **unsupported components retain authored interaction, and Studio must visibly mark them unsupported.**

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
7. Visibly mark unsupported components when Edit mode would otherwise leave them interactive.

## r> RuntimeNodeObserver Status

`RuntimeNodeObserver` remains unnecessary. The marker selection model uses existing `wrapNode` and explicit touch recording; no node enumeration or measurement loop is required.

## Exact Final Outcome

**COMPONENT CONTRACT VALID, VALIDATION INCOMPLETE**

Reasoning:

- The cooperative component contract is valid at the model level: component-owned suppression, private uncontrolled state preservation, and explicit `resolveNodeProps` injection were all designed and implemented in the disposable probe.
- `wrapNode` integration is proven.
- The Runtime extension points (`resolveNodeProps`, `wrapNode`, `RuntimeRendererConfigProvider`) all exist in the installed `@ankhorage/runtime` and were exercised in probe design.
- The probe demonstrates stable component identity across mode transitions.
- The corrected ownership matrix shows Surface and ZORA changes are required for production adoption.
- Eighth and subsequent required manual Android tests (engaged tap selection, outer/nested scroll, long press, authored drag, movement cancellation, Disclosure state preservation, Input suppression/restoration, UIAutomator metadata, TalkBack) were not manually executed in this pass.

The contract is not approved for production implementation under this result.

## Committed File

- `docs/cooperative-interaction-integration-validation.md`

## Package / Lockfile / Changeset Status

No package, lockfile, production source, or changeset changes were made. The only intended repository change is the validation evidence document.

## Branch

`issue-156/cooperative-interaction-integration-validation`
