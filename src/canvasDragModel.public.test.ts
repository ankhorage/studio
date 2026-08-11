import { describe, expect, test } from 'bun:test';

import type {
  CanvasDragSessionResolution,
  CanvasDropZoneSlots,
  StudioCanvasDragPayload,
} from './canvasDragModel';
import {
  createStudioCanvasDragPayload,
  isStudioCanvasDragPayload,
  isValidCanvasDropZone,
  resolveCanvasDragSession,
  resolveCanvasDropZoneSlots,
} from './canvasDragModel';
import type { CanvasDropZoneResolution, ValidCanvasDropZoneResolution } from './canvasDropZones';

describe('canvas drag model public exports', () => {
  test('types and helpers are usable from the public module', () => {
    const payload: StudioCanvasDragPayload = createStudioCanvasDragPayload('node-1');
    const zone: CanvasDropZoneResolution = {
      kind: 'inside',
      status: 'valid',
      placement: { parentId: 'root', index: 0, kind: 'inside' },
    };
    const validZone: ValidCanvasDropZoneResolution | null = isValidCanvasDropZone(zone)
      ? zone
      : null;
    const slots: CanvasDropZoneSlots = resolveCanvasDropZoneSlots([zone]);
    const session: CanvasDragSessionResolution = resolveCanvasDragSession({
      activeDragNodeId: 'node-1',
      isEditMode: true,
      rootNode: { id: 'root', type: 'Screen', children: [{ id: 'node-1', type: 'Text' }] },
      selectedNodeId: 'node-1',
    });

    expect(isStudioCanvasDragPayload(payload)).toBe(true);
    expect(validZone?.kind).toBe('inside');
    expect(slots.insideDropZone?.kind).toBe('inside');
    expect(session.activeDragNodeId).toBe('node-1');
  });
});
