import type { UiNode } from '@ankhorage/contracts';

import type { NodePlacement, PlacementKind, StudioComponentMetaRegistry } from './index';
import { resolveInsertPlacement } from './index';

export interface ValidCanvasDropZoneResolution {
  kind: PlacementKind;
  status: 'valid';
  placement: NodePlacement;
}

interface InvalidCanvasDropZoneResolution {
  kind: PlacementKind;
  status: 'invalid';
  reason: string;
}

export type CanvasDropZoneResolution =
  | ValidCanvasDropZoneResolution
  | InvalidCanvasDropZoneResolution;

const DROP_ZONE_KINDS: readonly PlacementKind[] = ['before', 'inside', 'after'];

export function resolveCanvasDropZones(args: {
  root: UiNode;
  targetNodeId: string;
  draggedNode: UiNode;
  componentMeta: StudioComponentMetaRegistry;
}): readonly CanvasDropZoneResolution[] {
  const { root, targetNodeId, draggedNode, componentMeta } = args;

  return DROP_ZONE_KINDS.map((kind) => {
    if (draggedNode.id === targetNodeId) {
      return {
        kind,
        status: 'invalid',
        reason: 'Cannot drop a node onto itself.',
      };
    }

    const placement = resolveInsertPlacement({
      root,
      targetNodeId,
      childType: draggedNode.type,
      componentMeta,
      kind,
    });

    if (!placement.ok) {
      return {
        kind,
        status: 'invalid',
        reason: placement.reason.message,
      };
    }

    return {
      kind,
      status: 'valid',
      placement: placement.placement,
    };
  });
}

export function getValidCanvasDropZones(
  zones: readonly CanvasDropZoneResolution[],
): readonly ValidCanvasDropZoneResolution[] {
  return zones.filter((zone): zone is ValidCanvasDropZoneResolution => zone.status === 'valid');
}
