# Studio canvas interaction model

`@ankhorage/studio/canvasDragModel` provides package-neutral helpers for Studio canvas node
movement payloads, placement slots, measured drop-zone geometry, and drag-preview text.

## Import

```ts
import {
  createStudioCanvasDragPayload,
  isStudioCanvasDragPayload,
  resolveCanvasDragSession,
  resolveCanvasDragPreviewText,
  resolveCanvasDropZoneRect,
  resolveCanvasDropZoneSlots,
} from '@ankhorage/studio/canvasDragModel';
```

## Owned here

- Studio canvas node movement payload shape
- runtime guard for canvas movement payloads
- valid canvas placement-zone detection
- resolving before, inside, and after placement slots
- deriving drop-zone rectangles from measured Runtime node bounds
- selecting concise authored text for the measured-bounds drag preview
- resolving whether an active drag still belongs to the current edit selection and manifest tree

## Runtime integration

The generated local Studio host composes these helpers with `DropProvider`, `Draggable`,
`Draggable.Handle`, and `Droppable` imported directly from
`@ankhorage/react-native-reanimated-dnd-web`. It renders a 48-point handle only for the selected
non-root node, keeps the rest of the canvas on the stationary-selection path, and shows a
measured-bounds ghost while dragging.

Every rendered Runtime node becomes a measured target while a drag is active. The screen surface
supplies a synthetic root target on native, where the normal selection recorder intentionally does
not wrap the root. More specific targets are registered before broad ancestor zones so nested
placements win overlapping collision checks.

The UI adapter owns transient drag and hover state and resets it after cancellation or commit. Each
reset also advances the Draggable session identity, remounting the web adapter after it reports a
drop so committed translation and `DROPPED` state cannot leak into the next interaction. The
selected node ID is part of that identity, so changing selection also creates a fresh adapter
instance.

An active drag is exposed to Runtime measurement and the overlay only while Edit mode is active,
the active node is still selected, and the node still exists in the current root. Selection loss,
tree removal, and Preview transitions synchronously suppress drag geometry and clear transient
state. A valid drop invokes the context's placement mutation exactly once. The package-neutral
model remains free of gestures, React lifecycle, concrete ZORA metadata, and manifest persistence.
