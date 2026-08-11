import { describe, expect, test } from 'bun:test';

import type { CanvasDropZoneResolution } from '../../canvasDropZones';
import {
  activateCanvasDrag,
  commitCanvasDrop,
  resetCanvasDragSession,
  sortCanvasDropTargetsBySpecificity,
} from './canvasDndInteraction';

const VALID_ZONE: CanvasDropZoneResolution = {
  kind: 'inside',
  status: 'valid',
  placement: { parentId: 'root', index: 0, kind: 'inside' },
};

const INVALID_ZONE: CanvasDropZoneResolution = {
  kind: 'inside',
  status: 'invalid',
  reason: { code: 'cannot-move-into-self', message: 'Cannot move into itself.' },
};

describe('canvas DnD interaction', () => {
  test('commits a valid drop exactly once', () => {
    const calls: unknown[][] = [];
    const committed = commitCanvasDrop(
      { kind: 'studio-canvas-node', nodeId: 'text' },
      VALID_ZONE,
      (...args) => {
        calls.push(args);
        return true;
      },
    );

    expect(committed).toBe(true);
    expect(calls).toEqual([['text', VALID_ZONE.placement]]);
  });

  test('never commits invalid zones or foreign payloads', () => {
    let commitCount = 0;
    const moveNode = () => {
      commitCount += 1;
      return true;
    };

    expect(
      commitCanvasDrop({ kind: 'studio-canvas-node', nodeId: 'text' }, INVALID_ZONE, moveNode),
    ).toBe(false);
    expect(commitCanvasDrop({ kind: 'external', nodeId: 'text' }, VALID_ZONE, moveNode)).toBe(
      false,
    );
    expect(commitCount).toBe(0);
  });

  test('activates the payload node and clears all transient state on reset', () => {
    const activeNodeIds: (string | null)[] = [];
    const activeZoneIds: (string | null)[] = ['target:inside'];
    const callbacks = {
      setActiveDragNodeId: (nodeId: string | null) => {
        activeNodeIds.push(nodeId);
      },
      setActiveDropZoneId: (zoneId: string | null) => {
        activeZoneIds.push(zoneId);
      },
    };

    activateCanvasDrag({ kind: 'studio-canvas-node', nodeId: 'text' }, callbacks);
    expect(activeNodeIds).toEqual(['text']);

    resetCanvasDragSession(callbacks);
    expect(activeNodeIds).toEqual(['text', null]);
    expect(activeZoneIds).toEqual(['target:inside', null]);
  });

  test('orders nested measured targets before broad ancestor targets', () => {
    const root = { id: 'root', rect: { width: 400, height: 800 } };
    const child = { id: 'child', rect: { width: 200, height: 80 } };
    const edge = { id: 'child:before', rect: { width: 200, height: 24 } };

    expect(sortCanvasDropTargetsBySpecificity([root, child, edge])).toEqual([edge, child, root]);
  });
});
