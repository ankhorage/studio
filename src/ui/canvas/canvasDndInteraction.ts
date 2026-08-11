import { isStudioCanvasDragPayload, type StudioCanvasDragPayload } from '../../canvasDragModel';
import type { CanvasDropZoneResolution } from '../../canvasDropZones';
import type { NodePlacement } from '../../index';

export interface CanvasDragSessionCallbacks {
  readonly restartDraggable: () => void;
  readonly setActiveDragNodeId: (nodeId: string | null) => void;
  readonly setActiveDropZoneId: (zoneId: string | null) => void;
}

export function createCanvasDraggableSessionKey(nodeId: string, revision: number): string {
  return `${nodeId}:${revision}`;
}

export function sortCanvasDropTargetsBySpecificity<
  T extends { readonly rect: { readonly width: number; readonly height: number } },
>(targets: readonly T[]): readonly T[] {
  return [...targets].sort(
    (left, right) => left.rect.width * left.rect.height - right.rect.width * right.rect.height,
  );
}

export function resetCanvasDragSession(callbacks: CanvasDragSessionCallbacks): void {
  callbacks.setActiveDropZoneId(null);
  callbacks.setActiveDragNodeId(null);
  callbacks.restartDraggable();
}

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

export function activateCanvasDrag(
  payload: StudioCanvasDragPayload,
  callbacks: Pick<CanvasDragSessionCallbacks, 'setActiveDragNodeId'>,
): void {
  callbacks.setActiveDragNodeId(payload.nodeId);
}
