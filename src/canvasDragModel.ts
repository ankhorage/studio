import type { UiNode } from '@ankhorage/contracts';

import type { CanvasDropZoneResolution, ValidCanvasDropZoneResolution } from './canvasDropZones';
import type { PlacementKind } from './index';
import { readOwnProperty } from './utils/readOwnProperty';

export interface CanvasRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const MIN_DROP_ZONE_SIZE = 24;
const MAX_DROP_ZONE_SIZE = 96;

export interface StudioCanvasDragPayload {
  kind: 'studio-canvas-node';
  nodeId: string;
}

export interface CanvasDropZoneSlots {
  validDropZones: readonly ValidCanvasDropZoneResolution[];
  beforeDropZone: ValidCanvasDropZoneResolution | null;
  insideDropZone: ValidCanvasDropZoneResolution | null;
  afterDropZone: ValidCanvasDropZoneResolution | null;
}

export interface CanvasDragSessionResolution {
  readonly activeDragNodeId: string | null;
  readonly shouldReset: boolean;
}

function treeContainsNode(root: UiNode, nodeId: string): boolean {
  if (root.id === nodeId) return true;
  return root.children?.some((child) => treeContainsNode(child, nodeId)) ?? false;
}

export function resolveCanvasDragSession(args: {
  readonly activeDragNodeId: string | null;
  readonly isEditMode: boolean;
  readonly rootNode: UiNode | null;
  readonly selectedNodeId: string | null;
}): CanvasDragSessionResolution {
  const { activeDragNodeId } = args;
  if (!activeDragNodeId) {
    return { activeDragNodeId: null, shouldReset: false };
  }

  const isValid =
    args.isEditMode &&
    args.selectedNodeId === activeDragNodeId &&
    args.rootNode !== null &&
    treeContainsNode(args.rootNode, activeDragNodeId);

  return isValid
    ? { activeDragNodeId, shouldReset: false }
    : { activeDragNodeId: null, shouldReset: true };
}

export function createStudioCanvasDragPayload(nodeId: string): StudioCanvasDragPayload {
  return { kind: 'studio-canvas-node', nodeId };
}

export function isStudioCanvasDragPayload(value: unknown): value is StudioCanvasDragPayload {
  if (typeof value !== 'object' || value === null) return false;
  if (!('kind' in value) || !('nodeId' in value)) return false;

  const candidate = value as { kind?: unknown; nodeId?: unknown };
  return candidate.kind === 'studio-canvas-node' && typeof candidate.nodeId === 'string';
}

export function isValidCanvasDropZone(
  zone: CanvasDropZoneResolution,
): zone is ValidCanvasDropZoneResolution {
  return zone.status === 'valid';
}

export function resolveCanvasDropZoneSlots(
  zones: readonly CanvasDropZoneResolution[],
): CanvasDropZoneSlots {
  const validDropZones = zones.filter(isValidCanvasDropZone);

  return {
    validDropZones,
    beforeDropZone: findDropZoneByKind(validDropZones, 'before'),
    insideDropZone: findDropZoneByKind(validDropZones, 'inside'),
    afterDropZone: findDropZoneByKind(validDropZones, 'after'),
  };
}

function findDropZoneByKind(
  zones: readonly ValidCanvasDropZoneResolution[],
  kind: PlacementKind,
): ValidCanvasDropZoneResolution | null {
  return zones.find((zone) => zone.kind === kind) ?? null;
}

export function resolveCanvasDropZoneRect(args: {
  readonly kind: PlacementKind;
  readonly targetRect: CanvasRect;
  readonly draggedRect: CanvasRect;
}): CanvasRect {
  const { kind, targetRect, draggedRect } = args;
  const edgeSize = Math.max(MIN_DROP_ZONE_SIZE, Math.min(MAX_DROP_ZONE_SIZE, draggedRect.height));

  if (kind === 'before') {
    return {
      x: targetRect.x,
      y: targetRect.y - edgeSize / 2,
      width: targetRect.width,
      height: edgeSize,
    };
  }
  if (kind === 'after') {
    return {
      x: targetRect.x,
      y: targetRect.y + targetRect.height - edgeSize / 2,
      width: targetRect.width,
      height: edgeSize,
    };
  }

  const inset = Math.min(edgeSize / 2, targetRect.width / 4, targetRect.height / 4);
  return {
    x: targetRect.x + inset,
    y: targetRect.y + inset,
    width: Math.max(MIN_DROP_ZONE_SIZE, targetRect.width - inset * 2),
    height: Math.max(MIN_DROP_ZONE_SIZE, targetRect.height - inset * 2),
  };
}

export function resolveCanvasDragPreviewText(
  props: Record<string, unknown> | undefined,
): string | null {
  if (!props) return null;
  for (const key of ['children', 'text', 'title', 'label', 'description']) {
    const value = readOwnProperty<unknown>(props, key);
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim().slice(0, 80);
    }
  }
  return null;
}
