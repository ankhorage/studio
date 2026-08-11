import type { UiNode } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import {
  createStudioCanvasDragPayload,
  isStudioCanvasDragPayload,
  isValidCanvasDropZone,
  resolveCanvasDragPreviewText,
  resolveCanvasDragSession,
  resolveCanvasDropZoneRect,
  resolveCanvasDropZoneSlots,
} from './canvasDragModel';
import type { CanvasDropZoneResolution } from './canvasDropZones';

const VALID_INSIDE_ZONE: CanvasDropZoneResolution = {
  kind: 'inside',
  status: 'valid',
  placement: { parentId: 'root', index: 0, kind: 'inside' },
};

const INVALID_BEFORE_ZONE: CanvasDropZoneResolution = {
  kind: 'before',
  status: 'invalid',
  reason: { code: 'child-not-allowed', message: 'Cannot insert here.' },
};

const VALID_AFTER_ZONE: CanvasDropZoneResolution = {
  kind: 'after',
  status: 'valid',
  placement: { parentId: 'root', index: 1, kind: 'after', referenceId: 'child' },
};

const ROOT_NODE: UiNode = {
  id: 'root',
  type: 'Screen',
  children: [
    { id: 'node-a', type: 'Text' },
    { id: 'node-b', type: 'Text' },
  ],
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

  test('derives before, inside, and after geometry from measured Runtime bounds', () => {
    const targetRect = { x: 20, y: 40, width: 200, height: 120 };
    const draggedRect = { x: 0, y: 0, width: 100, height: 48 };

    expect(resolveCanvasDropZoneRect({ kind: 'before', targetRect, draggedRect })).toEqual({
      x: 20,
      y: 16,
      width: 200,
      height: 48,
    });
    expect(resolveCanvasDropZoneRect({ kind: 'inside', targetRect, draggedRect })).toEqual({
      x: 44,
      y: 64,
      width: 152,
      height: 72,
    });
    expect(resolveCanvasDropZoneRect({ kind: 'after', targetRect, draggedRect })).toEqual({
      x: 20,
      y: 136,
      width: 200,
      height: 48,
    });
  });

  test('uses authored text for the measured-bounds drag preview', () => {
    expect(resolveCanvasDragPreviewText({ children: '  Welcome  ', title: 'Fallback' })).toBe(
      'Welcome',
    );
    expect(resolveCanvasDragPreviewText({ children: 12, label: 'Card' })).toBe('Card');
    expect(resolveCanvasDragPreviewText({ children: 12 })).toBeNull();
    expect(resolveCanvasDragPreviewText(undefined)).toBeNull();
  });

  test('keeps a drag active while edit selection and the current tree own that node', () => {
    expect(
      resolveCanvasDragSession({
        activeDragNodeId: 'node-a',
        isEditMode: true,
        rootNode: ROOT_NODE,
        selectedNodeId: 'node-a',
      }),
    ).toEqual({ activeDragNodeId: 'node-a', shouldReset: false });
  });

  test('resets an active drag when selection changes or is lost', () => {
    expect(
      resolveCanvasDragSession({
        activeDragNodeId: 'node-a',
        isEditMode: true,
        rootNode: ROOT_NODE,
        selectedNodeId: 'node-b',
      }),
    ).toEqual({ activeDragNodeId: null, shouldReset: true });
    expect(
      resolveCanvasDragSession({
        activeDragNodeId: 'node-a',
        isEditMode: true,
        rootNode: ROOT_NODE,
        selectedNodeId: null,
      }),
    ).toEqual({ activeDragNodeId: null, shouldReset: true });
  });

  test('resets an active drag in Preview or when the node leaves the current root', () => {
    expect(
      resolveCanvasDragSession({
        activeDragNodeId: 'node-a',
        isEditMode: false,
        rootNode: ROOT_NODE,
        selectedNodeId: 'node-a',
      }),
    ).toEqual({ activeDragNodeId: null, shouldReset: true });
    expect(
      resolveCanvasDragSession({
        activeDragNodeId: 'missing-node',
        isEditMode: true,
        rootNode: ROOT_NODE,
        selectedNodeId: 'missing-node',
      }),
    ).toEqual({ activeDragNodeId: null, shouldReset: true });
  });

  test('does not request another reset after transient drag state is already clear', () => {
    expect(
      resolveCanvasDragSession({
        activeDragNodeId: null,
        isEditMode: false,
        rootNode: null,
        selectedNodeId: null,
      }),
    ).toEqual({ activeDragNodeId: null, shouldReset: false });
  });
});
