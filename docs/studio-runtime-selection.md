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
