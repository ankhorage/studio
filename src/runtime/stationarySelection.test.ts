import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'bun:test';

const sourcePath = join(import.meta.dir, 'stationarySelection.ts');
const source = readFileSync(sourcePath, 'utf8');

describe('stationarySelection RN integration', () => {
  it('uses exactly one Gesture.Tap() invocation', () => {
    const matches = source.match(/Gesture\.Tap\(\)/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('uses exactly one GestureDetector', () => {
    const importLine = "import { Gesture, GestureDetector } from 'react-native-gesture-handler';";
    const withoutImport = source.replace(importLine, '');
    const matches = withoutImport.match(/GestureDetector/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('enables runOnJS(true)', () => {
    expect(source).toContain('.runOnJS(true)');
  });

  it('begins transaction in onBegin', () => {
    expect(source).toContain('.onBegin(() => {');
    expect(source).toContain('generationRef.current = coordinator.beginTransaction()');
  });

  it('commits in onEnd only on success', () => {
    expect(source).toContain('.onEnd((_event, success) => {');
    expect(source).toContain('if (!success) {');
    expect(source).toContain('coordinator.commitSelection(');
  });

  it('finalizes in onFinalize', () => {
    expect(source).toContain('.onFinalize(() => {');
    expect(source).toContain('coordinator.clearTransaction(generationRef.current)');
  });

  it('does not use onStart', () => {
    expect(source).not.toContain('.onStart(() => {');
  });

  it('does not use legacy TapGestureHandler', () => {
    expect(source).not.toContain('TapGestureHandler');
  });

  it('does not use per-node recognizer', () => {
    const matches = source.match(/Gesture\.Tap\(\)/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('does not use Pressable', () => {
    expect(source).not.toContain('Pressable');
  });

  it('does not use cloneElement', () => {
    expect(source).not.toContain('cloneElement');
  });

  it('does not use responder capture', () => {
    expect(source).not.toContain('onResponderGrant');
    expect(source).not.toContain('onResponderReject');
  });

  it('uses display contents for layout-neutral wrapper', () => {
    expect(source).toContain("display: 'contents'");
  });

  it('preserves unsupported indicator with pointerEvents none', () => {
    expect(source).toContain("pointerEvents: 'none'");
  });

  it('places pointerEvents as a View prop, not inside style', () => {
    const indicatorMatch = /React\.createElement\(View,\s*\{[^}]*style:\s*\{[^}]*\}[^}]*\}\)/.exec(
      source,
    );
    expect(indicatorMatch).not.toBeNull();
    const indicatorBlock = indicatorMatch?.[0] ?? '';
    expect(indicatorBlock).toContain("pointerEvents: 'none'");
    const styleBlock = /style:\s*\{([^}]*)\}/.exec(indicatorBlock);
    expect(styleBlock).toBeTruthy();
    expect(styleBlock?.[1]).not.toContain('pointerEvents');
  });

  it('uses lazy coordinator creation', () => {
    expect(source).toContain(
      'const coordinatorRef = React.useRef<StationarySelectionCoordinator | null>(null);',
    );
    expect(source).toContain('coordinatorRef.current ??= createStationarySelectionCoordinator();');
    expect(source).not.toContain('useRef(createStationarySelectionCoordinator())');
  });

  it('records touch with generation validation', () => {
    expect(source).toContain('ctx.recordNode(nodeId)');
  });

  it('uses bubble phase onTouchStart', () => {
    expect(source).toContain('onTouchStart: handleTouchStart');
  });
});
