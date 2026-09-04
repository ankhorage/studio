import type { UiNode } from '@ankhorage/contracts';
import { filterBy } from '@ankhorage/utility/array';

import type {
  NodePlacement,
  PlacementFailureReason,
  PlacementKind,
  StudioComponentMetaRegistry,
} from './index';
import { resolveInsertPlacement, resolveMoveNodePlacement } from './index';

export interface ValidCanvasDropZoneResolution {
  kind: PlacementKind;
  status: 'valid';
  placement: NodePlacement;
}

interface InvalidCanvasDropZoneResolution {
  kind: PlacementKind;
  status: 'invalid';
  reason: PlacementFailureReason;
}

export type CanvasDropZoneResolution =
  ValidCanvasDropZoneResolution | InvalidCanvasDropZoneResolution;

const DROP_ZONE_KINDS: readonly PlacementKind[] = ['before', 'inside', 'after'];

/***
 * Resolve every Studio canvas placement kind as a valid or invalid drop zone for the dragged node.
 * @todo Move Studio canvas drop-zone behavior under src/canvas/.
 */
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
        reason: {
          code: 'cannot-move-into-self',
          message: 'Cannot drop a node onto itself.',
        },
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
        reason: placement.reason,
      };
    }

    const movement = resolveMoveNodePlacement({
      root,
      nodeId: draggedNode.id,
      placement: placement.placement,
      componentMeta,
    });
    if (!movement.ok) {
      return {
        kind,
        status: 'invalid',
        reason: movement.reason,
      };
    }

    return {
      kind,
      status: 'valid',
      placement: movement.placement,
    };
  });
}

/***
 * Filter Studio drop-zone resolutions to only their valid variants.
 * @utility @ankhorage/utility/array
 */
export function getValidCanvasDropZones(
  zones: readonly CanvasDropZoneResolution[],
): readonly ValidCanvasDropZoneResolution[] {
  return filterBy(zones, (zone): zone is ValidCanvasDropZoneResolution => zone.status === 'valid');
}
