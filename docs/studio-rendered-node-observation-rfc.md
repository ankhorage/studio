# Studio Rendered Node Observation RFC

## Executive Decision

Add a **generic optional `RuntimeNodeObserver` callback** to `@ankhorage/runtime` that allows any external consumer to observe actual rendered host geometry and mount lifecycle for manifest nodes. Geometry observation and action suppression remain separate concerns.

No existing wrapper, boundary, or harness architecture can reliably expose visual bounds for arbitrary authored content without either private platform APIs, authored component changes, or layout-semantic mutation. The proposed contract is the smallest generic extension that unblocks partial observation while honestly documenting its platform limits.

## Evidence Summary

Three executed evidence passes established:

- **Focused boundary**: A per-node interactive `Pressable` boundary is invalid because React Native Web renders `Pressable` with `tabindex="0"`, mutating authored accessibility semantics.
- **Edit canvas renderer spike**: A centralized web capture controller with inert node markers and independent chrome satisfied the real Chrome acceptance checks but was web-only and duplicated significant Runtime behavior.
- **Native controller with wrapper measurement**: A public-API-only native controller with wrapper measurement partially supports selection and action suppression, but wrapper geometry is unreliable for absolute-positioned overlapping nodes:
  - `absolute-back` measured with `height=0`
  - `absolute-front` measured with `height=0`

Cross-package inspection confirms:

- `RuntimeRenderer` creates each manifest-node React element via `<Component {...props}>{componentChildren}</Component>` and currently distinguishes neither composite components from measurable host roots nor fragments from concrete views.
- React Native primitive components (`View`, `Text`, etc.) accept refs and expose `measure`/`measureInWindow`. Composite components that do not use `forwardRef` do not expose a host ref.
- React Native's `collapsable` behavior flattens parentless `View` nodes into ancestors, making them unmeasurable as separate roots.
- React Native Web maps RN components to DOM elements; DOM nodes can be measured with `getBoundingClientRect` but composite RN components without `forwardRef` do not expose their internal DOM root via a React ref.
- `@ankhorage/contracts` defines `UiNode` but contains no rendering or observation contracts.
- `@ankhorge` / `expo-runtime` is currently build-time planning only and contains no runtime rendering surface.

## Exact Blocker

Studio cannot determine visible bounds or visually topmost/deepest targets for manifest nodes because:

1. Runtime does not expose a mapping from manifest node IDs to rendered host instances.
2. The only existing public extension point (`wrapNode`) wraps the React element tree before mount, making post-mount observation impossible without a wrapper.
3. Wrapper components mutate authored layout and accessibility, which the evidence proved unacceptable.
4. Composite ZORA components (`DisclosureSection`, `Card`, `Button`, etc.) do not forward refs, so native `measure` and web DOM refs return `null`.
5. No public cross-platform primitive exists to query the shadow/DOM tree for painted bounds by arbitrary selector without private APIs.

## Option Comparison

### Option A: Generic host-ref observer hook

Runtime exposes an optional callback when the actual rendered host instance for a Runtime node becomes available.

**Feasibility**: Partially possible. Runtime can attach a `ref` callback to `<Component>` when the component accepts refs (native primitives, `forwardRef` components). For function components without `forwardRef`, the ref is `null`. Runtime cannot force composite components to expose host refs without mutating authored component source.

**Verdict**: Technically viable for native primitives and `forwardRef` components. Not viable as a complete solution for arbitrary authored content. **Rejected as sole mechanism, but adopted as a partial building block within Option E.**

### Option B: Generic measurable-boundary contract

Runtime supports an optional platform-provided layout observation boundary whose semantics are non-interactive, non-accessible, layout-transparent, platform-owned, and capable of reporting actual painted bounds.

**Feasibility**: Not viable without cloning or mutating authored component props. A boundary component is a wrapper by definition. The evidence proved that a `View` wrapper around absolute-positioned children reports `height=0` because absolute children do not contribute to parent layout. A `display: contents` boundary on web has no box and cannot report bounds. The proposed semantics are contradictory: a boundary must have a host instance to be measurable, and a host instance participates in layout.

**Verdict**: Same failed wrapper architecture under a new name. **Rejected.**

### Option C: Component metadata measurement adapter

Component registrations optionally provide a generic observation or measurement adapter describing how to resolve the component's visual host root.

**Feasibility**: Not generic. Every ZORA component would need to implement the adapter, leaking authoring concerns into UI packages. Third-party components cannot participate. Fragment and multi-root behavior is undefined. The adapter describes authored component implementation details, not generic runtime behavior.

**Verdict**: Couples observation to authoring contracts. **Rejected.**

### Option D: Platform-rendered node surface

A platform runtime owns a canonical node surface for each manifest node and renders the authored component inside it.

**Feasibility**: This IS wrapper architecture. A "canonical node surface" is a wrapper component. It duplicates Runtime rendering, diverges semantic behavior from generated apps, and violates the repository convergence direction. No lower primitive can preserve absolute layout and host geometry while wrapping arbitrary authored content.

**Verdict**: Equivalent to the already-failed wrapper approach with added maintenance burden. **Rejected.**

### Option E: Rendered-node geometry events (Recommended)

Runtime/platform emits generic geometry snapshots via an optional observer callback.

**Feasibility**: Partially viable. Runtime can invoke a callback when a node's React element is created and when its host instance becomes available (via ref callback). The consumer performs platform-specific measurement. For composite components without host refs, the consumer receives `null` and must handle incomplete data.

**Web sketch**: Runtime attaches a ref callback to `<Component>`. If the component renders a DOM element and accepts refs (direct DOM element or `forwardRef`), the ref callback captures the DOM node. The observer calls `getBoundingClientRect()`. For composite components, `hostRef` is `null`.

**Native sketch**: Runtime attaches a ref callback to `<Component>`. For native primitives, the ref is the native view instance. The observer calls `measure()` / `measureInWindow()`. For composite components, `hostRef` is `null`. Native platform code sets `collapsable={false}` only when the consumer opts in via `observeHost: true`, and only on primitive component types where the prop is meaningful.

**Partial unblock**: This provides real geometry for measurable nodes and honest `null` for unmeasurable nodes. Studio can use the partial data to drive selection chrome with graceful degradation.

**Verdict**: **Recommended.** Smallest generic extension with honest limitation documentation.

### Option F: Explicit Edit renderer fork

Studio implements a dedicated manifest renderer using Runtime registries but not Runtime's normal rendering path.

**Feasibility**: This duplicates Runtime rendering, action/data binding, navigation, and state. It guarantees semantic drift from generated apps and violates the convergence direction stated in AGENTS.md. It could never remain behaviorally identical to ordinary generated apps.

**Verdict**: Last-resort baseline only. **Rejected.**

## Recommended Contract

### `RuntimeNodeObserver`

An optional callback interface provided via `RuntimeRendererConfig`. Zero behavior when absent.

```ts
// @ankhorage/runtime

export interface RuntimeNodeObservation {
  readonly nodeId: string;
  readonly hostRef: unknown | null;
  readonly platform: 'web' | 'native';
}

export type RuntimeNodeObserver = (observation: RuntimeNodeObservation) => (() => void) | void;

export interface RuntimeRendererConfig {
  // ...existing fields...
  observeNode?: RuntimeNodeObserver;
}
```

**Minimality test result**: Removed every field not strictly required:

- No selection state
- No selection chrome
- No editor mode
- No Studio-specific names
- No bounding rect (consumer computes from hostRef)
- No paint order (observable but not guaranteed by this contract)
- No z-index (observable via hostRef style but not reported by contract)

### Lifecycle Sequence

```
RuntimeRenderer renders node
  |
  +--> Resolve Component from registry
  +--> Resolve props (bindings, actions, events)
  +--> Render children recursively via RuntimeRenderer
  +--> Create <Component ref={captureRef} {...props}>{children}</Component>
  |
  +--> commit phase
       |
       +--> captureRef(hostInstance) is invoked by React
       |    hostInstance is:
       |      - native component instance (View, Text, etc.) on native
       |      - DOM element on web (if component exposes ref)
       |      - null for function components without forwardRef
       |
       +--> effectiveConfig.observeNode({
       |      nodeId: node.id,
       |      hostRef: hostInstance,
       |      platform: resolvePlatform(),
       |    })
       |
       +--> Consumer calls hostRef.measure() or hostRef.getBoundingClientRect()
       +--> Consumer emits geometry event with actual bounds or null
       |
  +--> Return <RuntimeRendererConfigProvider value={explicitConfig}>{content}</RuntimeRendererConfigProvider>
```

### Web Implementation Sketch

```ts
// @ankhorage/runtime/internal/platformWeb.ts (conceptual, not public API)

export function createPlatformNodeObserver(
  emit: (observation: RuntimeNodeObservation) => void,
): RuntimeNodeObserver {
  return (observation: RuntimeNodeObservation) => {
    if (observation.hostRef instanceof HTMLElement) {
      const rect = observation.hostRef.getBoundingClientRect();
      emit({
        nodeId: observation.nodeId,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        depth: 0,
        paintOrder: 0,
      });
    } else {
      emit({
        nodeId: observation.nodeId,
        rect: null,
        depth: 0,
        paintOrder: 0,
      });
    }
  };
}
```

### Android Implementation Sketch

```ts
// @ankhorage/expo-runtime/internal/platformAndroid.ts (conceptual)

import { UIManager, findNodeHandle } from 'react-native';

export function createPlatformNodeObserver(
  emit: (observation: RuntimeNodeObservation) => void,
  opts: { observeHost?: boolean } = {},
): RuntimeNodeObserver {
  return (observation: RuntimeNodeObservation) => {
    const instance = observation.hostRef;
    if (instance && typeof instance.measure === 'function') {
      instance.measure((x, y, width, height, pageX, pageY) => {
        emit({
          nodeId: observation.nodeId,
          rect: { x: pageX, y: pageY, width, height },
          depth: 0,
          paintOrder: 0,
        });
      });
    } else if (instance && opts.observeHost && findNodeHandle(instance)) {
      const tag = findNodeHandle(instance);
      UIManager.measure(tag, (x, y, width, height, pageX, pageY) => {
        emit({
          nodeId: observation.nodeId,
          rect: { x: pageX, y: pageY, width, height },
          depth: 0,
          paintOrder: 0,
        });
      });
    } else {
      emit({
        nodeId: observation.nodeId,
        rect: null,
        depth: 0,
        paintOrder: 0,
      });
    }
  };
}
```

### iOS Implementation Sketch

```ts
// @ankhorge/expo-runtime/internal/platformIos.ts (conceptual)

export function createPlatformNodeObserver(
  emit: (observation: RuntimeNodeObservation) => void,
  opts: { observeHost?: boolean } = {},
): RuntimeNodeObserver {
  return (observation: RuntimeNodeObservation) => {
    const instance = observation.hostRef;
    if (instance && typeof instance.measure === 'function') {
      instance.measure((x, y, width, height, pageX, pageY) => {
        emit({
          nodeId: observation.nodeId,
          rect: { x: pageX, y: pageY, width, height },
          depth: 0,
          paintOrder: 0,
        });
      });
    } else if (instance && opts.observeHost) {
      // iOS uses native RCTComponent measure via ref
      instance.measure((x, y, width, height, pageX, pageY) => {
        emit({
          nodeId: observation.nodeId,
          rect: { x: pageX, y: pageY, width, height },
          depth: 0,
          paintOrder: 0,
        });
      });
    } else {
      emit({
        nodeId: observation.nodeId,
        rect: null,
        depth: 0,
        paintOrder: 0,
      });
    }
  };
}
```

### Studio Consumption Sketch

```ts
// @ankhorage/studio/src/runtime/nodeGeometryObserver.ts (conceptual)

import type { RuntimeNodeObserver, RuntimeNodeObservation } from '@ankhorage/runtime';

export interface StudioNodeGeometry {
  readonly nodeId: string;
  readonly rect: { x: number; y: number; width: number; height: number } | null;
  readonly depth: number;
}

export function createStudioNodeGeometryObserver(
  onGeometry: (geometry: StudioNodeGeometry) => void,
): RuntimeNodeObserver {
  return (observation: RuntimeNodeObservation) => {
    if (observation.hostRef === null) {
      onGeometry({ nodeId: observation.nodeId, rect: null, depth: 0 });
      return;
    }
    if (observation.platform === 'web') {
      const el = observation.hostRef as HTMLElement;
      const rect = el.getBoundingClientRect();
      onGeometry({
        nodeId: observation.nodeId,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        depth: 0,
      });
    } else {
      const instance = observation.hostRef as { measure: (cb: (...) => void) => void };
      instance.measure((x, y, width, height, pageX, pageY) => {
        onGeometry({
          nodeId: observation.nodeId,
          rect: { x: pageX, y: pageY, width, height },
          depth: 0,
        });
      });
    }
  };
}
```

### Action-Suppression Analysis

Action suppression and geometry observation are orthogonal capabilities.

**Action suppression** is already a first-class Runtime capability via `RuntimeRendererConfig.disableActions`. When `true`, Runtime wraps action and event props to prevent authored handlers from executing. This is tested and used by Studio in the existing `RuntimeRendererConfigProvider` / `StudioShell` path (`src/host/layout/templates/rootLayout.ts:701`). `disableActions` suppresses Runtime-dispatched actions and events. Authored component-local behavior that does not flow through Runtime's action system (e.g., internal `DisclosureSection` expand/collapse state) is outside Runtime's suppression scope and must remain outside Runtime's concern.

Studio can continue to use `disableActions: true` together with a centralized platform gesture controller (web capture controller or native gesture handler) for edit-mode interaction. No generic Runtime extension is required for action suppression.

**Geometry observation** requires the proposed `RuntimeNodeObserver` because it depends on host instance availability, which only materializes after React commits the native/DOM tree.

### Performance and Cleanup

- **Frequency**: Observer callbacks fire once per node per mount. Re-renders that preserve the same host instance do not re-fire unless the host ref callback is re-invoked (React guarantees ref callbacks are called with `null` before the new instance, then with the new instance).
- **Cleanup**: The observer callback may return an optional cleanup function. Runtime invokes it when the node unmounts or when the observer config changes.
- **Stale references**: Consumers must not hold host refs beyond the cleanup callback. Host refs become invalid after unmount.
- **Batching**: Platform measurement (`measure`, `getBoundingClientRect`) is synchronous on web and asynchronous (callback-based) on native. Consumers must handle both patterns.
- **Concurrent features**: For React concurrent rendering, ref callbacks may fire multiple times. Consumers should deduplicate by `nodeId` and platform measurement stability.

### Limitations

The `RuntimeNodeObserver` contract **cannot guarantee**:

- Geometry for composite components without measurable host refs (`hostRef === null`).
- Exact visual paint ordering (`paintOrder`) for overlapping siblings. Sibling ordering depends on DOM/native insertion order, z-index, and platform-specific compositing rules that are not exposed through public refs. A consumer MAY compute paint order from additional platform APIs (e.g., web `elementFromPoint`, native `bringToFront`/`sendToBack` side effects) but these are outside this contract.
- Geometry for portal content rendered outside the Runtime tree (modals, native modals, third-party portals).
- Geometry for list items whose native/DOM nodes are recycled or virtualized. The observer fires for currently mounted instances; recycled instances fire again when remounted.
- Scroll-relative coordinates without consumer-side scroll-container tracking.
- Transform-aware bounds. `measure`/`getBoundingClientRect` report transformed bounds on web and native; transforms applied by the host platform are included, but Animated-driven transforms may be mid-flight.

### Ownership Decision

**`@ankhorage/runtime`** owns the `RuntimeNodeObserver` interface and invokes it from `RuntimeRenderer`.

Rationale:

- Runtime is the sole owner of the manifest-node rendering lifecycle and the only place where host instance availability can be detected generically.
- `@ankhorage/contracts` owns static manifest schema but not rendering behavior contracts. The observer is a runtime callback, not a manifest field.
- `@ankhorage/expo-runtime` owns platform-specific runtime planning but not generic rendering primitives. Platform observer implementations may live in expo-runtime's internal platform modules, but the public callback interface belongs in Runtime.
- Studio cannot own this capability because it would couple generic runtime observation to Studio selection semantics, violating the convergence direction.

**Semantic-version impact**: New optional field on `RuntimeRendererConfig`. Additive, non-breaking change. Patch bump.

## Proof Plan

1. **Add the generic primitive in its owning package**
   - Repository: `ankhorage/runtime`
   - Branch: `runtime-node-observer`
   - Files: `dist/RuntimeRendererConfig.d.ts`, `dist/RuntimeRenderer.js`, source maps
   - Adds `observeNode?: RuntimeNodeObserver` to `RuntimeRendererConfig`
   - No public API removal

2. **Add package-local unit and platform tests**
   - Repository: `ankhorage/runtime`
   - Branch: same as above
   - Test gate: observer callback invoked with correct `nodeId`, `hostRef` availability, cleanup on unmount

3. **Release the owning package**
   - Repository: `ankhorage/runtime`
   - Publish patch version
   - `Refs #156` or related tracking issue

4. **Update Studio dependency**
   - Repository: `ankhorage/studio`
   - Branch: `studio-consume-node-observer`
   - Update `@ankhorage/runtime` dependency
   - Implement `createStudioNodeGeometryObserver` using the new config field
   - Wire into `RuntimeRendererConfigProvider` in generated root layout

5. **Reconstruct the already-proven web controller**
   - Repository: `ankhorage/studio`
   - Branch: same as above
   - Implement web capture controller using `observeNode` + DOM `getBoundingClientRect`
   - Gate behind `__DEV__` in generated root layout

6. **Add the native controller**
   - Repository: `ankhorage/studio`
   - Branch: `studio-native-node-observer`
   - Implement native geometry observer using `observeNode` + `measure`/`measureInWindow`
   - Test on Android and iOS generated apps

7. **Execute generated web, Android, and iOS validation**
   - Generate test apps from Studio templates
   - Verify observer fires for measurable primitive nodes
   - Verify graceful null handling for composite nodes
   - Verify action suppression (`disableActions`) remains orthogonal
   - Document observed gap for composite-component geometry

8. **Implement final independent chrome and remaining #156 acceptance criteria**
   - Repository: `ankhorage/studio`
   - Independent chrome rendered outside Runtime tree (proven acceptable in edit-canvas-renderer spike)
   - Selection state computed from partial geometry data with explicit fallbacks
   - Execute #156 acceptance criteria

## Cross-Repository Rollout

| Step | Repository          | Branch                         | Allowed Files                     | Test Gate                | PR Relation             |
| ---- | ------------------- | ------------------------------ | --------------------------------- | ------------------------ | ----------------------- |
| 1    | `ankhorage/runtime` | `runtime-node-observer`        | `dist/*`, source in package       | Unit tests pass          | `Refs #156`             |
| 2    | `ankhorage/runtime` | same                           | same                              | Platform matrix pass     | Same PR                 |
| 3    | `ankhorage/runtime` | release                        | package version                   | CI green                 | Separate publish        |
| 4    | `ankhorage/studio`  | `studio-consume-node-observer` | `src/runtime/*`, generated layout | Unit tests pass          | `Refs #156`             |
| 5    | `ankhorage/studio`  | same                           | `src/ui/*`, `src/host/*`          | Web smoke test           | Same PR                 |
| 6    | `ankhorage/studio`  | `studio-native-node-observer`  | `src/runtime/*`                   | Native unit tests        | Separate PR, same issue |
| 7    | `ankhorage/studio`  | same                           | generated apps                    | E2E web/native/ios       | Same PR                 |
| 8    | `ankhorage/studio`  | `studio-selection-final`       | `src/ui/selection/*`              | #156 acceptance criteria | Final PR                |

Do not merge a cross-repository mega-branch. Each repository changes independently behind the released interface boundary.

## Issue #156 Amendment

```markdown
### Amendment: Generic Rendered-Node Observation Primitive

The current issue boundary prohibits production changes outside `ankhorage/studio`.
Executed evidence demonstrates that the current public Studio-only integration surface
(`wrapNode`, native wrapper measurement) cannot reliably expose host geometry for
arbitrary authored content. To unblock Studio selection while preserving convergence,
the following amendment is approved:

1. **`@ankhorage/runtime`** may add a single new optional public callback:
   `RuntimeNodeObserver` on `RuntimeRendererConfig`. This is the **only** allowed
   public API change outside `ankhorage/studio`.

2. `@ankhorage/runtime` may invoke this callback from `RuntimeRenderer` when a
   rendered node's host instance becomes available, providing `nodeId`, `hostRef`,
   and `platform`. `hostRef` is `null` for nodes without measurable host refs.

3. `@ankhorage/runtime` may add internal platform observer implementations in
   `@ankhorage/expo-runtime` (or a future platform runtime) but must not expose
   Studio-specific geometry or selection types in any public package API.

4. **`ankhorage/studio`** must not add selection concepts, chrome, or editor mode
   to `@ankhorage/runtime`, `@ankhorage/expo-runtime`, `@ankhorage/contracts`,
   ZORA, Surface, templates, or any platform package. Studio selection remains
   owned entirely within `ankhorage/studio`.

5. Studio may consume `RuntimeNodeObserver` only after `@ankhorage/runtime` has
   released a version containing the new field. No branch or monorepo shortcut
   is permitted.

6. The `RuntimeNodeObserver` contract is documented as best-effort. It provides
   real geometry for native primitive components and `forwardRef` components.
   It explicitly does NOT guarantee geometry for composite components without
   measurable host refs. Studio selection chrome must degrade gracefully when
   `hostRef` is `null`.

7. Action suppression remains the separate existing `disableActions` field.
   No new action-suppression primitive is required by this amendment.

8. All other refactor, restructuring, or cleanup work in shared packages is
   prohibited by this amendment.

9. `Refs #156` must remain on all PRs until final acceptance criteria pass.

10. The existing PR policy and review requirements are unchanged.
```

## Final Outcome

**MINIMAL GENERIC EXTENSION IDENTIFIED**

Add `observeNode?: RuntimeNodeObserver` to `@ankhorage/runtime`'s `RuntimeRendererConfig`. This is the smallest generic extension that unblocks partial geometry observation without introducing Studio concepts into Runtime, ZORA, Contracts, expo-runtime, or platform packages.

The extension honestly documents that composite components without measurable host refs return `null`, which is a platform limitation, not a contract failure. Studio selection chrome must be designed to work with incomplete geometry data.

No production implementation is included in this RFC. Implementation must occur in the sequence defined in the Proof Plan after the issue amendment is approved.
