# Studio Runtime selection

Generated apps compose Studio selection through the normal Runtime renderer configuration:
`wrapNode` records the bubbling node path, while one root gesture recognizer commits a stationary
selection. Edit mode supplies `interactionPolicy="passive"` only to components that explicitly
support the canonical policy; Preview restores `enabled`.

The same root selection surface owns canvas drag composition in Edit mode. A selected non-root node
gets one 48-point `Draggable.Handle`; the selected component itself remains on the stationary tap
path. The handle and every drop target use `@ankhorage/react-native-reanimated-dnd-web` directly,
so native and web share the adapter contract without `@ankhorage/studio/dnd*` wrapper APIs. Preview
mounts no drag overlay and clears an active drag if mode changes.

Starting a drag activates public geometry measurement for every rendered Runtime node. Web and
Expo 57 native both use public element descendant bounds; the root surface contributes its own
bounds. Before, inside, and after zones
are resolved through caller-injected component metadata and the canonical `NodePlacement` rules.
Invalid zones remain visible with their structured reason. A measured-bounds ghost includes the
component label and the first useful authored text property. Cancellation and commit both release
drag geometry, hover state, and the ghost.

Stationary native Runtime selection remains supported and was validated on Android: stationary
Edit taps select the deepest intended node once, movement and scrolling cancel unintended
selection, passive interaction preserves nested scrolling and authored state, and Preview restores
authored interaction. PR #176 does not change that native interaction architecture.

The root selection surface renders selected-node chrome on web, Android, and iOS with the current
ZORA primary action semantic. The layout-neutral recorder contributes the bubbling node path and
uses public descendant geometry without becoming an authored layout box. Measurement stops at the
first positive-area host on each rendered branch, so a component is outlined by its authored outer
host rather than by an inner control or overflowing descendant. Screen roots retain the same
recorder with selection recording disabled, allowing Select parent to outline the actual root.

Native measurement uses the DOM-like element-ref APIs supplied by React Native 0.86 through Expo
57: `children`, `parentElement`, `getBoundingClientRect()`, `isConnected`, and `ownerDocument`.
Disconnected, cross-document, non-finite, and zero-area geometry is rejected. Visible geometry is
clipped to native scroll viewports and the selection canvas before projection into root-local
coordinates. No ZORA or Surface component needs to forward a Studio ref or consume a Studio
contract.

Unsupported native extension components retain the established authored-root contract. Attach
`useStudioUnsupportedNodeMeasurement()` from `@ankhorage/studio/runtime` to the extension's
existing measurable root:

```tsx
const measurement = useStudioUnsupportedNodeMeasurement();

return (
  <View ref={measurement.ref} onLayout={measurement.onLayout}>
    {children}
  </View>
);
```

The hook registers that existing root through the same public element-ref geometry API. Non-zero
geometry is translated into coordinates owned by the root selection surface and drives the
distinct dashed unsupported indicator without a layout-changing wrapper or private React
Native/Fabric APIs.

On web, Runtime-node registration stores a lazy `getResizeTargets()` callback. Descendants are not
traversed and are not observed merely because a node rendered. Inactive registration changes also
avoid a complete scan of the Runtime-node registry. Only the selected node and visible unsupported
nodes activate resize targets while idle; an active canvas drag temporarily activates every
rendered Runtime node. Selection, drag, or Edit/Preview changes compute the complete desired
target set, observe newly required elements, and unobserve elements no longer required. Because the
set is deduplicated before diffing, a shared descendant is observed once and remains observed while
any active measurement still requires it.

The unsupported-node visual indicator remains a distinct dashed layer rendered by the root
selection surface. Selected and unsupported overlays use `pointerEvents="none"`, remain hidden from
accessibility, and never intercept authored input. Web uses captured scroll/resize events and
`ResizeObserver`. Native samples only the mounted selected host subtree and root, with at most one
non-overlapping measurement per animation frame, so momentum, nested/programmatic scrolling,
orientation, keyboard, and content-driven layout changes stay aligned. Unchanged geometry does not
commit React state. The native loop stops on Clear, invalid selection, Preview, backgrounding, or
unmount; authored-root layout events and the bounded settle path continue to serve unsupported-only
indicators. Preview renders no selected chrome, unsupported chrome, or canvas drag affordances.

The generated Studio shell synchronizes the current app pathname into `StudioProvider`. Studio
resolves the owning screen recursively from the manifest navigator, so selections on nested Stack,
Tabs, and Drawer screens remain valid while their node exists. Moving to a different screen or
deleting the selected node clears stale selection; opening an admin route retains the last valid app
screen context without creating a second navigation model.

The app AppBar switches the existing `StudioProvider` session between Edit and Preview without
replacing the generated route tree, Runtime renderer, manifest, or component registry. Both modes
continue to use the generated app's `ZORA_COMPONENT_REGISTRY` plus app extensions. Edit separately
supplies `interactionPolicy="passive"` and `disableActions=true`; Preview supplies
`interactionPolicy="enabled"` and `disableActions=false`. Consequently, Preview navigation changes
the canonical Expo Router location, and returning to Edit stays on the reached app route while it
remains valid.

Path-derived context is authoritative while `activePathname` is supplied. Explicitly requested
screen context remains available for hosts without pathname synchronization and becomes the
preserved app context while generated shells are on `/ankh/*`. If Studio is opened directly on an
admin route before an app pathname has been observed, the provider resolves the initial leaf by
following `initialRouteName` recursively through route groups and nested Stack, Tabs, or Drawer
navigators, falling back only when an initial route cannot reach a manifest screen.
