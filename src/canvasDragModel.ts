import type { PlacementKind } from './index';
import type {
  CanvasDropZoneResolution,
  ValidCanvasDropZoneResolution,
} from './canvasDropZones';

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
