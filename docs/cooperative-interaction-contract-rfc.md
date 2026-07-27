# Cooperative Interaction Contract RFC

## Established Evidence

Prior evidence commits:

- `57d1df70` - manual native gesture results
- `545a2f42` - edit interaction policy evaluation
- `98bd9cab` - tightened edit interaction evidence

Prior conclusion: `COMPONENT COOPERATION REQUIRED`

Established facts from prior evidence:

- Runtime `disableActions` suppresses action-shaped values and string action IDs.
- Runtime preserves arbitrary function callbacks.
- Platform interception alone does not suppress Button or Disclosure behavior.
- A registry adapter cannot read or freeze private uncontrolled component state.
- The component owning private callbacks, gestures, or state must cooperate.
- Disabled props suppress activation but alter authored styling and expose disabled accessibility semantics.
- `RuntimeNodeObserver` remains unnecessary.
- Marker plus cooperative-component suppression had not yet been executed end-to-end.
- Nested scrolling, authored drag, long press, and actual TalkBack behavior remained unexecuted.

## Runtime Extension-Point Inspection

### Exact source inspected

- `@ankhorage/runtime` `0.3.0`
  - `dist/RuntimeRenderer.js`
  - `dist/RuntimeRendererConfig.js`
  - `dist/runtimeNodeProps.js`
  - `dist/runtimeNodeProps.d.ts`
- `@ankhorage/contracts` `2.1.0`
  - `dist/runtimeCallbacks.d.ts`

### `resolveNodeProps` signature

```ts
type RuntimeNodePropsResolver = (args: {
  node: UiNode;
  props: Record<string, unknown>;
  bindingContext?: Record<string, unknown>;
  dataBindings?: ComponentDataBindingRegistry;
  dataSources?: DataSourceRegistry;
  dbAdapter?: DbAdapter;
  dbRealtimeAdapter?: DbRealtimeAdapter;
  operationResults?: RuntimeBindingOperationResultCache;
  stateAdapter?: StateAdapter;
}) => Record<string, unknown> | void;
```

### Answers to inspection questions

1. Full signature: as above.
2. Receives the Runtime node: yes, `node: UiNode`.
3. Receives resolved props: yes, `props: Record<string, unknown>`.
4. Knows node/component type: yes, via `node.type`.
5. Runs before or after action wrapping: before. `RuntimeRenderer` calls `resolveRuntimeNodeProps` first, then passes the result to `wrapRuntimeActionProps`.
6. May safely add a prop only to selected component types: yes, because it receives `node.type` and can branch on it.
7. Can preserve existing resolved props: yes, by returning `{ ...props, ...extra }` or returning `props` unchanged.
8. Can be composed with authored `resolveNodeProps`: yes. The resolver receives the already-resolved props from authored resolution/data binding, so it can augment without replacing.
9. Whether Studio already supplies a resolver: yes. `src/runtime/previewRuntimeConfig.ts` supplies `resolveNodeProps` for Studio-specific prop injection.
10. Whether existing API can inject cooperative policy without Runtime change: yes. No Runtime public API change is required.

### `RuntimeRenderer` rendering order (installed source)

```js
const resolvedProps = resolveRuntimeNodeProps({
  node,
  props,
  ...
});
const propsWithActions = wrapRuntimeActionProps({
  props: resolvedProps,
  disableActions,
  ...
});
const propsWithEvents = wrapRuntimeEventProps({
  props: propsWithActions,
  ...
});
// Component rendered with propsWithEvents
// wrapNode wraps rendered output
```

## Selected Policy

### Name

`interactionPolicy`

### Shape

```ts
type InteractionPolicy = 'enabled' | 'passive';
```

### Semantics

**enabled**: normal authored application behavior.

**passive**: render the same authored representation, but suppress direct authored user activation, value editing, component-local toggles, long press, and authored manipulation gestures; preserve structural scrolling and layout.

## Candidate Comparison

### Candidate A: existing `resolveNodeProps` (SELECTED)

Studio or the registry uses the existing resolver to inject `interactionPolicy: 'passive'` into explicitly known component types.

Advantages:

- no Runtime public API change
- no registry-shape change
- explicit node-type mapping
- optional component participation
- existing behavior preserved when no policy is injected

Risks:

- resolver ownership may become Studio-specific (acceptable; Studio already owns `resolveNodeProps` in `previewRuntimeConfig`)
- authored resolver composition (mitigated by spread-preserving pattern)
- component capability registry duplicated outside component registration (acceptable; explicit allowlist)

### Candidate B: parallel capability map

Not approved. The existing `resolveNodeProps` already provides an explicit node-type mapping point. A separate map adds indirection without solving a missing capability.

### Candidate C: component prop (SELECTED SHAPE)

Cooperative components expose an optional generic prop named `interactionPolicy` with shape `'enabled' | 'passive'`.

This is the minimal component-side contract. It is not Studio-specific and does not contain prohibited terminology.

### Candidate D: shared context/provider

Rejected. Ownership is unclear. Surface depending on Runtime would violate package layering. A Runtime-owned context would make Surface and third-party components depend on Runtime. Duplicate package instances could create separate context identities. Explicit prop delivery is safer and more deterministic.

### Candidate E: new Runtime registry entry shape

Not approved. The existing `resolveNodeProps` already makes this unnecessary. No registry-shape change is required.

## Component-Owned Implementation Model

The cooperative component owns suppression of its private behavior.

### Button-like

```tsx
const activationAllowed = interactionPolicy !== 'passive';

<Pressable
  onPress={activationAllowed ? onPress : undefined}
  onLongPress={activationAllowed ? onLongPress : undefined}
>
  {children}
</Pressable>;
```

### Disclosure-like (uncontrolled)

```tsx
const [internalOpen, setInternalOpen] = useState(defaultOpen);

const toggle = () => {
  if (interactionPolicy === 'passive') return;
  setInternalOpen((v) => !v);
  onOpenChange?.(!internalOpen);
};
```

### Input/Textarea

```tsx
<TextInput
  value={value}
  editable={interactionPolicy !== 'passive'}
  readOnly={interactionPolicy === 'passive'}
  onChangeText={(text) => {
    if (interactionPolicy === 'passive') return;
    setValue(text);
  }}
/>
```

Note: `readOnly` visually preserves appearance but on Android the soft keyboard may still deliver input. The component must guard its own `onChangeText` handler.

## Integrated Execution

### Probe setup

Disposable Android harness: `/private/tmp/ankh-studio-native-event-path-probe`

Real `@ankhorage/runtime` `0.3.0` loaded via symlink into probe `node_modules`.

Diagnostics emitted:

- `[CONTRACT_PROBE_MODE]`
- `[CONTRACT_DELIVERY]`
- `[CONTRACT_MODE]`
- `[CONTRACT_POLICY]`
- `[BUTTON_PRESS]`
- `[DISCLOSURE_TOGGLE]`
- `[INPUT_CHANGE]`
- `[MARKER-CAPTURE]`

### Baseline result

3/3 Expo web smoke tests passed on `origin/main`.

### Real RuntimeRenderer executed

Yes. Probe loaded successfully with:

```
I ReactNativeJS: [CONTRACT_PROBE_MODE] edit
I ReactNativeJS: [CONTRACT_DELIVERY] resolveNodeProps
I ReactNativeJS: [CONTRACT_MODE] edit
I ReactNativeJS: [CONTRACT_POLICY] passive
```

### Policy delivery mechanism

`resolveNodeProps` in `RuntimeRendererConfig` injects `interactionPolicy: 'passive'` into cooperative component types before action wrapping. The resolver preserves existing resolved props via spread.

## Executed Results

### Button passive/Preview result

Start: passive/edit mode.

Action: tapped cooperative Button rendered via `RuntimeRenderer`.

Observed:

- `BUTTON_PRESS` did NOT execute in passive mode.
- UIAutomator showed button `enabled="true"`, `clickable="false"`.
- Authored enabled styling remained unchanged (no disabled visual styling).
- Dimensions remained unchanged.

Classification: **PASS in passive mode**.

Preview restoration: not yet executed in this pass.

### Uncontrolled Disclosure state-preservation result

Start: passive/edit mode, Disclosure closed.

Observed:

- `DISCLOSURE_TOGGLE` did NOT execute.
- Disclosure remained closed after tap.
- UIAutomator showed disclosure `enabled="true"`, `clickable="false"`.

Mode transition test (passive -> enabled -> toggle -> passive -> toggle): not yet executed in this pass.

Classification: **PASS for passive suppression**. State preservation across mode transitions remains **UNEXECUTED**.

### Input/Textarea result

Start: passive/edit mode, input value "initial".

Action: soft keyboard input "test".

Observed:

- UIAutomator showed input `enabled="true"`, `clickable="true"`.
- `[INPUT_CHANGE] initialtest` logged.
- Visual appearance unchanged.

Classification: **PARTIAL**. The component-owned `onChangeText` guard is required. `readOnly` alone did not prevent Android soft-keyboard input in this probe. The contract requires the component to suppress its own state change, which the model supports but was not fully implemented in this probe iteration.

### Outer-scroll result

Not yet executed.

Classification: **UNEXECUTED**.

### Nested-scroll result

Not yet executed.

Classification: **UNEXECUTED**.

### Long-press result

Not yet executed.

Classification: **UNEXECUTED**.

### Drag result

Not yet executed.

Classification: **UNEXECUTED**.

### Marker integration result

`wrapNode` is confirmed to wrap rendered output in `RuntimeRenderer`. The Marker component in this probe used `onStartShouldSetResponder` and `onResponderStart`, but no `[MARKER-CAPTURE]` logs appeared during interaction.

Classification: **PARTIAL**. `wrapNode` integration is proven. Responder-based tap-slop/cancellation for marker selection remains **UNEXECUTED**. The current marker responder approach appears to be overridden by inner Pressable responder capture.

### Movement-versus-selection result

Not yet executed.

Classification: **UNEXECUTED**. A tap-slop/cancellation controller for the marker is required but not yet implemented or tested.

### Authored visual-appearance result

UIAutomator confirmed all passive components retained `enabled="true"`. No disabled accessibility semantics were exposed.

Classification: **PASS**.

### UIAutomator metadata result

Executed for all interactive fixture types.

Classification: **EXECUTED**.

### TalkBack status

Not yet executed.

Classification: **NOT EXECUTED**.

## Unsupported-Component Fallback

Components without explicit `interactionPolicy` support retain existing authored behavior. Studio must classify unsupported components explicitly rather than silently passing the prop.

Selected fallback: **unsupported and authored interaction remains enabled**.

Justification: silent prop injection into unaware components is undefined behavior. A deterministic fallback avoids hidden failures.

## Required Changes

### Runtime changes

**No Runtime change required.**

The existing `resolveNodeProps` extension point delivers the policy before action wrapping. `wrapNode` handles marker integration. No new public API is needed.

### Surface changes

Cooperative Surface components must opt in by:

- accepting `interactionPolicy?: 'enabled' | 'passive'`
- suppressing their own activation, editing, and manipulation callbacks in passive mode
- preserving authored visual representation
- guarding state-changing handlers (e.g., `onChangeText`)

Affected components:

- Button
- IconButton
- Card with `onPress`
- DisclosureSection
- Tabs
- Select
- Input / Textarea
- Modal
- Drawer

Third-party custom components may adopt the same pattern.

### ZORA changes

None. ZORA patterns remain unchanged. Cooperative behavior is expressed through component props, not ZORA metadata.

### Studio changes

Studio must:

1. Supply a `resolveNodeProps` resolver that injects `interactionPolicy: 'passive'` into declared-capable component types during Edit mode.
2. Preserve authored `resolveNodeProps` via spread composition.
3. Compose with existing `disableActions` (Redux-style action suppression).
4. Switch to `'enabled'` in Preview mode.
5. Maintain an explicit allowlist of component types that support the contract.

Third-party opt-in model:

- Components declare support by accepting the `interactionPolicy` prop.
- No registration-time adapter is required.
- No reflection or capability inference is required.
- Unknown components receive no policy prop and retain normal behavior.

## Migration and Backward Compatibility

- Default behavior is `'enabled'`. Existing authored applications are unchanged.
- The prop is optional. Components that do not recognize it ignore it.
- No registry shape change is required.
- No Runtime public API change is required.

## Limitations

- Structural scrolling (outer and nested ScrollView) remains **UNEXECUTED** in this pass.
- Authored long press and drag remain **UNEXECUTED**.
- Marker tap-slop/cancellation remains **UNEXECUTED**.
- TalkBack behavior remains **UNEXECUTED**.
- Android soft-keyboard input to `TextInput` may bypass `readOnly`; the component must guard its `onChangeText` handler.

## Final Outcome

**COMPONENT CONTRACT VALID, INTEGRATION INCOMPLETE**

The existing Runtime extension points can deliver a generic passive interaction policy to explicitly capable components without changing Runtime public APIs. The component-owned internal-state model preserves private uncontrolled state and authored visual appearance. Cooperative Button and Disclosure suppression is proven through the actual RuntimeRenderer path. Remaining unexecuted items include structural scrolling, nested scroll, long press, authored drag, marker tap-slop/cancellation, Preview restoration across mode transitions, and TalkBack behavior.

## Committed File

- `docs/cooperative-interaction-contract-rfc.md`
