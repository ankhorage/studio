# Studio canvas interaction model

`@ankhorage/studio/canvasDragModel` provides package-neutral helpers for Studio canvas node movement payloads and canvas placement slot selection.

## Import

```ts
import {
  createStudioCanvasDragPayload,
  isStudioCanvasDragPayload,
  resolveCanvasDropZoneSlots,
} from '@ankhorage/studio/canvasDragModel';
```

## Owned here

- Studio canvas node movement payload shape
- runtime guard for canvas movement payloads
- valid canvas placement-zone detection
- resolving before, inside, and after placement slots

## Host-owned concerns

Hosts still own the gesture implementation, React rendering, hover/focus state, styles, and concrete move execution.
