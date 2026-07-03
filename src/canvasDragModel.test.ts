import { describe, expect, test } from 'bun:test';

import type { CanvasDropZoneResolution } from './canvasDropZones';
import {
  createStudioCanvasDragPayload,
  isStudioCanvasDragPayload,
  isValidCanvasDropZone,
  resolveCanvasDropZoneSlots,
} from './canvasDragModel';

const VALID_INSIDE_ZONE: CanvasDropZoneResolution = {
  kind: 'inside',
  status: 'valid',
  placement: { parentId: 'root', index: 0, kind: 'inside' },
};

const INVALID_BEFORE_ZONE: CanvasDropZoneResolution = {
  kind: 'before',
  status: 'invalid',
  reason: 'Cannot insert here.',
};

const VALID_AFTER_ZONE: CanvasDropZoneResolution = {
  kind: 'after',
  status: 'valid',
  placement: { parentId: 'root', index: 1, kind: 'after', referenceId: 'child' },
};

describe('canvasDragModel', () => {
  test('creates and detects Studio canvas drag payloads', () => {
    const payload = createStudioCanvasDragPayload('node-1');

    expect(payload).toEqual({ kind: 'studio-canvas-node', nodeId: 'node-1' });
    expect(isStudioCanvasDragPayload(payload)).toBe(true);
    expect(isStudioCanvasDragPayload({ kind: 'other', nodeId: 'node-1' })).toBe(false);
    expect(isStudioCanvasDragPayload({ kind: 'studio-canvas-node', nodeId: 1 })).toBe(false);
    expect(isStudioCanvasDragPayload(null)).toBe(false);
  });

  test('detects valid canvas drop zones', () => {
    expect(isValidCanvasDropZone(VALID_INSIDE_ZONE)).toBe(true);
    expect(isValidCanvasDropZone(INVALID_BEFORE_ZONE)).toBe(false);
  });

  test('resolves drop zone slots by placement kind', () => {
    const slots = resolveCanvasDropZoneSlots([
      INVALID_BEFORE_ZONE,
      VALID_INSIDE_ZONE,
      VALID_AFTER_ZONE,
    ]);

    expect(slots.validDropZones).toEqual([VALID_INSIDE_ZONE, VALID_AFTER_ZONE]);
    expect(slots.beforeDropZone).toBeNull();
    expect(slots.insideDropZone).toBe(VALID_INSIDE_ZONE);
    expect(slots.afterDropZone).toBe(VALID_AFTER_ZONE);
  });
});
