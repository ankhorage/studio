import { describe, expect, test } from 'bun:test';

import type { CanvasDropZoneResolution } from '../../canvasDropZones';
import {
  activateCanvasDrag,
  commitCanvasDrop,
  completeCanvasDropAfterAdapter,
  createCanvasDraggableSessionKey,
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
    let revision = 0;
    const callbacks = {
      restartDraggable: () => {
        revision += 1;
      },
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
    expect(revision).toBe(1);
  });

  test('remounts a neutral draggable session after a successful adapter drop', async () => {
    const activeNodeIds: (string | null)[] = [];
    const activeZoneIds: (string | null)[] = [];
    const moveCalls: unknown[][] = [];
    let revision = 0;
    const callbacks = {
      restartDraggable: () => {
        revision += 1;
      },
      setActiveDragNodeId: (nodeId: string | null) => activeNodeIds.push(nodeId),
      setActiveDropZoneId: (zoneId: string | null) => activeZoneIds.push(zoneId),
    };
    const initialKey = createCanvasDraggableSessionKey('text', revision);

    const completion = completeCanvasDropAfterAdapter(
      { kind: 'studio-canvas-node', nodeId: 'text' },
      VALID_ZONE,
      (...args) => {
        moveCalls.push(args);
        return true;
      },
      () => resetCanvasDragSession(callbacks),
    );

    expect(moveCalls).toEqual([]);
    expect(revision).toBe(0);
    expect(await completion).toBe(true);
    expect(moveCalls).toEqual([['text', VALID_ZONE.placement]]);
    expect(activeNodeIds).toEqual([null]);
    expect(activeZoneIds).toEqual([null]);
    expect(createCanvasDraggableSessionKey('text', revision)).not.toBe(initialKey);
  });

  test('remounts away adapter translation after an invalid droppable hit', async () => {
    let moveCount = 0;
    let revision = 0;
    const initialKey = createCanvasDraggableSessionKey('text', revision);

    const committed = await completeCanvasDropAfterAdapter(
      { kind: 'studio-canvas-node', nodeId: 'text' },
      INVALID_ZONE,
      () => {
        moveCount += 1;
        return true;
      },
      () =>
        resetCanvasDragSession({
          restartDraggable: () => {
            revision += 1;
          },
          setActiveDragNodeId: () => undefined,
          setActiveDropZoneId: () => undefined,
        }),
    );

    expect(committed).toBe(false);
    expect(moveCount).toBe(0);
    expect(createCanvasDraggableSessionKey('text', revision)).not.toBe(initialKey);
  });

  test('uses selected node identity as part of the adapter session key', () => {
    expect(createCanvasDraggableSessionKey('node-a', 3)).not.toBe(
      createCanvasDraggableSessionKey('node-b', 3),
    );
  });

  test('orders nested measured targets before broad ancestor targets', () => {
    const root = { id: 'root', rect: { width: 400, height: 800 } };
    const child = { id: 'child', rect: { width: 200, height: 80 } };
    const edge = { id: 'child:before', rect: { width: 200, height: 24 } };

    expect(sortCanvasDropTargetsBySpecificity([root, child, edge])).toEqual([edge, child, root]);
  });
});
