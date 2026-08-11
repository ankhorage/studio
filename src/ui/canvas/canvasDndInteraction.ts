import { isStudioCanvasDragPayload, type StudioCanvasDragPayload } from '../../canvasDragModel';
import type { CanvasDropZoneResolution } from '../../canvasDropZones';
import type { NodePlacement } from '../../index';

export interface CanvasDragSessionCallbacks {
  readonly setActiveDragNodeId: (nodeId: string | null) => void;
  readonly setActiveDropZoneId: (zoneId: string | null) => void;
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

export function activateCanvasDrag(
  payload: StudioCanvasDragPayload,
  callbacks: Pick<CanvasDragSessionCallbacks, 'setActiveDragNodeId'>,
): void {
  callbacks.setActiveDragNodeId(payload.nodeId);
}
