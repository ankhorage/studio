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

  it('renders root-owned unsupported indicators with pointerEvents none', () => {
    expect(source).toContain('...indicatorRects.map((rect) =>');
    expect(source).toContain("pointerEvents: 'none'");
  });

  it('retains duplicate live wrapper measurements for the same Runtime node', () => {
    expect(source).toContain('new Map<string, Set<MeasureUnsupportedNode>>()');
    expect(source).toContain('measurements.add(measure)');
    expect(source).toContain('ref: setViewRef');
  });

  it('places pointerEvents as a View prop, not inside style', () => {
    const indicatorStart = source.indexOf('...indicatorRects.map((rect) =>');
    const indicatorBlock = source.slice(indicatorStart);
    expect(indicatorBlock).toContain("pointerEvents: 'none'");
    const styleBlock = /style:\s*\{([\s\S]*?)\n\s*\},/.exec(indicatorBlock);
    expect(styleBlock).toBeTruthy();
    expect(styleBlock?.[1]).not.toContain('pointerEvents');
  });

  it('does not position an indicator beneath the display-contents recorder', () => {
    const recorderStart = source.indexOf('function StudioNodeTouchRecorder');
    const wrapperFactoryStart = source.indexOf(
      'export function createStudioStationarySelectionWrapNode',
    );
    const recorderSource = source.slice(recorderStart, wrapperFactoryStart);

    expect(recorderSource).not.toContain("position: 'absolute'");
    expect(recorderSource).not.toContain('borderColor');
  });

  it('uses lazy coordinator creation', () => {
    expect(source).toContain(
      'const coordinatorRef = React.useRef<StationarySelectionCoordinator | null>(null);',
    );
    expect(source).toContain('coordinatorRef.current ??= createStationarySelectionCoordinator();');
    expect(source).not.toContain('useRef(createStationarySelectionCoordinator())');
  });

  it('records pointer and touch input with generation validation', () => {
    expect(source).toContain('ctx.recordNode(nodeId)');
    expect(source).toContain('onPointerDown: handleInteractionStart');
    expect(source).toContain('onTouchStart: handleInteractionStart');
    expect(source).toContain('pendingNodeIdsRef.current.push(nodeId)');
    expect(source).toContain('for (const nodeId of pendingNodeIdsRef.current)');
  });

  it('uses public element geometry only for web indication measurement', () => {
    expect(source).toContain("Platform.OS === 'web'");
    expect(source).toContain('getBoundingClientRect');
    expect(source).toContain('measureRenderedBoxes(child)');
    expect(source).not.toContain('findNodeHandle');
    expect(source).not.toContain('ReactNativePrivateInterface');
  });

  it('continuously refreshes indication geometry across scroll and layout changes', () => {
    expect(source).toContain('requestAnimationFrame(measureNextFrame)');
    expect(source).toContain('cancelAnimationFrame(frameId)');
  });
});
