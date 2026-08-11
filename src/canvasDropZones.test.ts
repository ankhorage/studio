import type { UiNode } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import {
  type CanvasDropZoneResolution,
  getValidCanvasDropZones,
  resolveCanvasDropZones,
  type ValidCanvasDropZoneResolution,
} from './canvasDropZones';
import type { StudioComponentMetaRegistry } from './index';

const componentMeta: StudioComponentMetaRegistry = {
  Screen: { category: 'layout', allowedChildren: ['Container', 'Text'] },
  Container: { category: 'layout', allowedChildren: ['Text'] },
  Text: { category: 'content', allowedChildren: [] },
};

function buildRoot(): UiNode {
  return {
    id: 'root',
    type: 'Screen',
    children: [
      {
        id: 'container',
        type: 'Container',
        children: [{ id: 'text', type: 'Text' }],
      },
      {
        id: 'source-container',
        type: 'Container',
        children: [{ id: 'dragged-text', type: 'Text' }],
      },
    ],
  };
}

describe('canvasDropZones', () => {
  test('resolves valid drop zones around a compatible target node', () => {
    const zones: readonly CanvasDropZoneResolution[] = resolveCanvasDropZones({
      root: buildRoot(),
      targetNodeId: 'container',
      draggedNode: { id: 'dragged-text', type: 'Text' },
      componentMeta,
    });
    const valid: readonly ValidCanvasDropZoneResolution[] = getValidCanvasDropZones(zones);

    expect(zones.map((zone) => zone.kind)).toEqual(['before', 'inside', 'after']);
    expect(valid.map((zone) => zone.kind)).toEqual(['before', 'inside', 'after']);
  });

  test('marks self-drop zones invalid', () => {
    const zones = resolveCanvasDropZones({
      root: buildRoot(),
      targetNodeId: 'container',
      draggedNode: { id: 'container', type: 'Container' },
      componentMeta,
    });

    expect(zones.every((zone) => zone.status === 'invalid')).toBe(true);
    expect(getValidCanvasDropZones(zones)).toEqual([]);
  });

  test('marks incompatible inside drops invalid while keeping sibling drops valid', () => {
    const zones = resolveCanvasDropZones({
      root: buildRoot(),
      targetNodeId: 'text',
      draggedNode: { id: 'dragged-container', type: 'Container' },
      componentMeta,
    });

    expect(zones).toEqual([
      expect.objectContaining({ kind: 'before', status: 'invalid' }),
      expect.objectContaining({ kind: 'inside', status: 'invalid' }),
      expect.objectContaining({ kind: 'after', status: 'invalid' }),
    ]);
  });

  test('preserves canonical descendant and no-op movement failures', () => {
    const descendantComponentMeta: StudioComponentMetaRegistry = {
      ...componentMeta,
      Container: { category: 'layout', allowedChildren: ['Container', 'Text'] },
      Text: { category: 'content', allowedChildren: ['Container'] },
    };
    const descendantZones = resolveCanvasDropZones({
      root: buildRoot(),
      targetNodeId: 'text',
      draggedNode: { id: 'container', type: 'Container' },
      componentMeta: descendantComponentMeta,
    });
    const descendantInsideZone = descendantZones.find((zone) => zone.kind === 'inside');
    expect(descendantInsideZone?.status).toBe('invalid');
    if (descendantInsideZone?.status === 'invalid') {
      expect(descendantInsideZone.reason.code).toBe('cannot-move-into-descendant');
    }

    const noOpZones = resolveCanvasDropZones({
      root: buildRoot(),
      targetNodeId: 'source-container',
      draggedNode: { id: 'container', type: 'Container' },
      componentMeta,
    });
    const noOpBeforeZone = noOpZones.find((zone) => zone.kind === 'before');
    expect(noOpBeforeZone?.status).toBe('invalid');
    if (noOpBeforeZone?.status === 'invalid') {
      expect(noOpBeforeZone.reason.code).toBe('no-op');
    }
  });
});
