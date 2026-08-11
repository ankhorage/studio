import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

const source = readFileSync(join(import.meta.dir, 'StudioCanvasDndOverlay.tsx'), 'utf8');

describe('Studio canvas DnD adapter integration', () => {
  test('imports and composes the cross-platform adapter directly', () => {
    expect(source).toContain("from '@ankhorage/react-native-reanimated-dnd-web'");
    expect(source).not.toContain("from 'react-native-reanimated-dnd'");
    expect(source).toContain('<DropProvider>');
    expect(source).toContain('<Draggable');
    expect(source).toContain('<Draggable.Handle style={{ width: 48, height: 48 }}>');
    expect(source).toContain('<Droppable');
  });

  test('uses measured Runtime geometry for its 48 point handle, ghost, and drop zones', () => {
    expect(source).toContain('resolveCanvasDropZoneRect({');
    expect(source).toContain('left: selectedRect.x + selectedRect.width - 24');
    expect(source).toContain('width: 48');
    expect(source).toContain('<CanvasDragPreview');
    expect(source).toContain('indicatorRects: props.indicatorRects');
  });

  test('wires canonical invalid reasons and lifecycle helpers into the adapter', () => {
    expect(source).toContain('props.zone.resolution.reason.message');
    expect(source).toContain('completeCanvasDropAfterAdapter(');
    expect(source).toContain(
      'key={createCanvasDraggableSessionKey(selectedNode.id, dragSessionRevision)}',
    );
  });
});
