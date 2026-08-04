# Studio Runtime selection

Generated apps compose Studio selection through the normal Runtime renderer configuration:
`wrapNode` records the bubbling node path, while one root gesture recognizer commits a stationary
selection. Edit mode supplies `interactionPolicy="passive"` only to components that explicitly
support the canonical policy; Preview restores `enabled`.

The same root selection surface measures the active Runtime node and renders its selected-state
outline with the current ZORA primary action semantic. Geometry ownership is separate from the
layout-neutral interaction recorder: the recorder only contributes the bubbling node path, while a
Runtime node's authored measurable root contributes its actual geometry. This keeps selection state
out of manifests and prevents Studio wrappers from becoming layout boxes.

Supported and unsupported Runtime components expose native geometry through the same canonical
provider contract. Attach `useStudioRuntimeNodeMeasurement()` from `@ankhorage/studio/runtime` to
the component's existing authored native root:

```tsx
const measurement = useStudioRuntimeNodeMeasurement();

return (
  <View ref={measurement.ref} onLayout={measurement.onLayout}>
    {children}
  </View>
);
```

The hook registers that root through React Native's public `measureInWindow` API. Non-zero geometry
is translated into coordinates owned by the root selection surface. The same contract covers
leaves, containers, screen roots, scroll movement, and responsive layout changes. The former
`useStudioUnsupportedNodeMeasurement()` name remains as a compatibility alias; it uses the same
provider and does not create a separate unsupported-component measurement path. An authored root
is preferred whenever both authored and recorder measurements exist.

On web, Runtime-node registration stores a lazy `getResizeTargets()` callback. Descendants are not
traversed and are not observed merely because a node rendered. Only the selected node and visible
unsupported nodes activate resize targets. Selection changes compute the complete desired target
set, observe newly required elements, and unobserve elements no longer required. Because the set is
deduplicated before diffing, a shared descendant is observed once and remains observed while any
active measurement still requires it.

The unsupported-node visual indicator remains a distinct dashed layer rendered by the root
selection surface. Selected and unsupported overlays both use `pointerEvents="none"`; scroll,
viewport resize, responsive layout, authored-root `onLayout`, and native settle refresh their
geometry. Changing or clearing selection immediately removes the previous selected outline.
Native scroll input starts a bounded settle sequence that stops after stable measurements or a
strict sample limit. Preview releases authoring ResizeObserver targets and renders neither selected
nor unsupported chrome. Unmount disconnects the observer and clears desired-target ownership;
navigation and measurement removal cancel pending work once no active indicator remains.

The generated Studio shell synchronizes the current app pathname into `StudioProvider`. Studio
resolves the owning screen recursively from the manifest navigator, so selections on nested Stack,
Tabs, and Drawer screens remain valid while their node exists. Moving to a different screen or
deleting the selected node clears stale selection; opening an admin route retains the last valid app
screen context without creating a second navigation model.

Path-derived context is authoritative while `activePathname` is supplied. Explicitly requested
screen context remains available for hosts without pathname synchronization and becomes the
preserved app context while generated shells are on `/ankh/*`. If Studio is opened directly on an
admin route before an app pathname has been observed, the provider resolves the initial leaf by
following `initialRouteName` recursively through route groups and nested Stack, Tabs, or Drawer
navigators, falling back only when an initial route cannot reach a manifest screen.
