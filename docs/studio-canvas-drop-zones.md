# Studio canvas drop zones

`@ankhorage/studio/canvasDropZones` provides package-neutral helpers for resolving valid canvas drop zones around a target node.

## Import

```ts
import { resolveCanvasDropZones, getValidCanvasDropZones } from '@ankhorage/studio/canvasDropZones';
```

## Owned here

- resolving `before`, `inside`, and `after` drop zones
- rejecting self-drops
- validating placements through Studio component metadata
- filtering valid drop zones

## Host-owned concerns

Hosts still own pointer handling, drag/drop gestures, visual overlays, dialogs, and React lifecycle wiring.
