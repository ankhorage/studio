# Studio Runtime selection

Generated apps compose Studio selection through the normal Runtime renderer configuration:
`wrapNode` records the bubbling node path, while one root gesture recognizer commits a stationary
selection. Edit mode supplies `interactionPolicy="passive"` only to components that explicitly
support the canonical policy; Preview restores `enabled`.

Unsupported extension components can expose indicator geometry on native by attaching
`useStudioUnsupportedNodeMeasurement()` from `@ankhorage/studio/runtime` to their existing native
root view:

```tsx
const measurement = useStudioUnsupportedNodeMeasurement();

return (
  <View ref={measurement.ref} onLayout={measurement.onLayout}>
    {children}
  </View>
);
```

The Studio recorder remains `display: "contents"` and therefore does not add a Yoga layout box.
The hook measures the component's authored root through React Native's public ref API. It does not
opt the component into interaction-policy support, clone the rendered element, or alter the
component's props or identity.

The visual indicator is rendered by the root selection surface with `pointerEvents="none"`.
Native scroll input starts a bounded settle sequence that stops after stable measurements or a
strict sample limit; Preview, unmount, navigation, and removal of the last unsupported measurement
cancel pending work.

The generated Studio shell synchronizes the current app pathname into `StudioProvider`. Studio
resolves the owning screen recursively from the manifest navigator, so selections on nested Stack,
Tabs, and Drawer screens remain valid while their node exists. Moving to a different screen or
deleting the selected node clears stale selection; opening an admin route retains the last valid app
screen context without creating a second navigation model.
