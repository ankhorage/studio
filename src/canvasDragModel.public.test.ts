import { describe, expect, test } from 'bun:test';

import type { CanvasDropZoneSlots, StudioCanvasDragPayload } from './canvasDragModel';
import {
  createStudioCanvasDragPayload,
  isStudioCanvasDragPayload,
  isValidCanvasDropZone,
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

    expect(isStudioCanvasDragPayload(payload)).toBe(true);
    expect(validZone?.kind).toBe('inside');
    expect(slots.insideDropZone?.kind).toBe('inside');
  });
});
