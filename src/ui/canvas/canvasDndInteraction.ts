import { isStudioCanvasDragPayload, type StudioCanvasDragPayload } from '../../canvasDragModel';
import type { CanvasDropZoneResolution } from '../../canvasDropZones';
import type { NodePlacement } from '../../index';

export interface CanvasDragSessionCallbacks {
  readonly restartDraggable: () => void;
  readonly setActiveDragNodeId: (nodeId: string | null) => void;
  readonly setActiveDropZoneId: (zoneId: string | null) => void;
}

/***
 * Build the composite key used to force a fresh draggable instance for one node/revision pair.
 * @utility @ankhorage/utility/string
 */
export function createCanvasDraggableSessionKey(nodeId: string, revision: number): string {
  return `${nodeId}:${revision}`;
}

/***
 * Return drop targets ordered from smallest rectangle area to largest so the most specific target wins first.
 * @utility @ankhorage/utility/geometry
 */
export function sortCanvasDropTargetsBySpecificity<
  T extends { readonly rect: { readonly width: number; readonly height: number } },
>(targets: readonly T[]): readonly T[] {
  return [...targets].sort(
    (left, right) => left.rect.width * left.rect.height - right.rect.width * right.rect.height,
  );
}

/***
 * Reset the active Studio canvas drag/drop state and force the draggable adapter to restart.
 * @todo Move this Studio canvas interaction orchestration beside the canvas domain instead of generic UI ownership.
 */
export function resetCanvasDragSession(callbacks: CanvasDragSessionCallbacks): void {
  callbacks.setActiveDropZoneId(null);
  callbacks.setActiveDragNodeId(null);
  callbacks.restartDraggable();
}

/***
 * Commit one valid Studio canvas drop by validating the Studio drag payload and forwarding its node to the resolved placement adapter.
 * @todo Move this Studio canvas drop policy beside the canvas domain; UI should invoke the use case rather than own it.
 */
export function commitCanvasDrop(
  payload: unknown,
  zone: CanvasDropZoneResolution,
  moveNodeToPlacement: (nodeId: string, placement: NodePlacement) => boolean,
): boolean {
  if (zone.status !== 'valid' || !isStudioCanvasDragPayload(payload)) {
    return false;
  }

  return moveNodeToPlacement(payload.nodeId, zone.placement);
}

/***
 * Defer one Studio canvas drop commit until after the DnD adapter callback and always reset drag state afterwards.
 * @todo Keep this adapter-timing orchestration at the canvas/DnD edge, not in a generic UI helper module.
 */
export function completeCanvasDropAfterAdapter(
  payload: unknown,
  zone: CanvasDropZoneResolution,
  moveNodeToPlacement: (nodeId: string, placement: NodePlacement) => boolean,
  resetDrag: () => void,
): Promise<boolean> {
  return Promise.resolve().then(() => {
    try {
      return commitCanvasDrop(payload, zone, moveNodeToPlacement);
    } finally {
      resetDrag();
    }
  });
}

/*** Activate the Studio canvas drag session for the node carried by a canonical drag payload. */
export function activateCanvasDrag(
  payload: StudioCanvasDragPayload,
  callbacks: Pick<CanvasDragSessionCallbacks, 'setActiveDragNodeId'>,
): void {
  callbacks.setActiveDragNodeId(payload.nodeId);
}
