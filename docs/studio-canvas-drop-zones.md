# Studio canvas drop zones

`@ankhorage/studio/canvasDropZones` provides package-neutral helpers for resolving canvas drop zones
around a rendered target node.

## Import

```ts
import { resolveCanvasDropZones, getValidCanvasDropZones } from '@ankhorage/studio/canvasDropZones';
```

## Owned here

- resolving `before`, `inside`, and `after` drop zones
- rejecting root, self, descendant, and no-op movement
- validating placements through caller-provided Studio component metadata
- preserving canonical placement failure codes and messages for invalid-zone feedback
- filtering valid drop zones

## Runtime integration

The package's generated Studio runtime owns pointer handling, direct adapter composition, visual
affordances, and React lifecycle wiring. Other hosts may render the same package-neutral zone
resolutions with their platform UI, but must execute successful drops through the canonical
`NodePlacement` mutation instead of maintaining a second tree-moving algorithm.
