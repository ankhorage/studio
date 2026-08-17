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

  it('keeps the per-node recorder layout-neutral on every platform', () => {
    expect(source).toContain("style: { display: 'contents' }");
    expect(source).not.toContain('collapsable: false');
  });

  it('keeps the authored-root provider scoped to native unsupported extensions', () => {
    expect(source).toContain('export function useStudioUnsupportedNodeMeasurement(): {');
    expect(source).not.toContain('useStudioRuntimeNodeMeasurement');
    expect(source).toContain('createNativeRuntimeNodeMeasurement(view');
    expect(source).toContain('RuntimeNodeMeasurementContext.Provider');
    expect(source).not.toContain("Platform.OS === 'web' ? measureRuntimeNodeWebView(view)");
  });

  it('renders root-owned unsupported indicators with pointerEvents none', () => {
    expect(source).toContain('rect.showUnsupportedIndicator');
    expect(source).toContain('studio-unsupported-indicator-');
    expect(source).toContain("pointerEvents: 'none'");
  });

  it('hides unsupported indicators synchronously in Preview', () => {
    expect(source).toContain('...(props.isEditMode');
    expect(source).toContain('? indicatorRects.filter((rect) => rect.showUnsupportedIndicator)');
  });

  it('retains duplicate live wrapper measurements for the same Runtime node', () => {
    expect(source).toContain('new Map<string, Set<RuntimeNodeMeasurement>>()');
    expect(source).toContain('measurements.add(measurement)');
    expect(source).toContain('ref: setViewRef');
  });

  it('places pointerEvents as a View prop, not inside style', () => {
    const indicatorStart = source.indexOf('studio-unsupported-indicator-');
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

  it('measures every Runtime node with public geometry for selection and canvas drag zones', () => {
    expect(source).toContain('ctx.registerRuntimeNode(');
    expect(source).toContain('nodeId,');
    expect(source).toContain('if (view && ctx && nodeId)');
    expect(source).toContain('measureRuntimeNodeWebView(view)');
    expect(source).toContain('measureNativeRuntimeNodeView(view)');
    expect(source).toContain("source: 'runtime-recorder'");
    expect(source).toContain('measureRuntimeNodeIndicators({');
    expect(source).toContain('activeDragNodeId: activeDragNodeIdRef.current');
    expect(source).toContain('canvasRootNodeId: canvasInteraction?.rootNode?.id');
  });

  it('mounts direct adapter-backed canvas interaction only for a valid Edit drag session', () => {
    expect(source).toContain('StudioCanvasDndOverlay');
    expect(source).toContain('props.isEditMode && canvasInteraction');
    expect(source).toContain('resolveCanvasDragSession({');
    expect(source).toContain('activeDragNodeId,');
    expect(source).toContain('setActiveDragNodeId?.(null)');
  });

  it('measures roots only on web without adding them to the stationary interaction path', () => {
    expect(source).toContain('recordSelection: !args.isRoot');
    expect(source).toContain('if (!ctx || !recordSelection || !nodeId)');
    expect(source).toContain("if (args.isRoot && Platform.OS !== 'web')");
  });

  it('renders theme-semantic selected chrome without intercepting input', () => {
    const selectedIndicatorStart = source.indexOf('studio-selected-indicator-');
    const selectedIndicatorBlock = source.slice(selectedIndicatorStart);

    expect(selectedIndicatorStart).toBeGreaterThan(-1);
    expect(selectedIndicatorBlock).toContain(
      '...createSelectedIndicatorViewProps(rect, theme.semantics.action.primary.base)',
    );
    expect(source).toContain(
      'shouldRenderSelectedNodeChrome(\n    Platform.OS,\n    props.isEditMode,\n    props.selectedNodeId,\n  )',
    );
  });

  it('suppresses selected chrome synchronously on native, in Preview, or without selection', () => {
    expect(source).toContain('...(shouldRenderSelectedChrome');
    expect(source).toContain('rect.nodeId === selectedIndicatorNodeId');
  });

  it('synchronizes resize targets only for active registration changes', () => {
    expect(source).toContain(
      'const nodeIsActive = runtimeNodeMeasurementChangeAffectsActiveIndicators',
    );
    expect(source).toContain(
      'const nodeWasActive = runtimeNodeMeasurementChangeAffectsActiveIndicators',
    );
    expect(source).toContain('if (nodeIsActive) {');
    expect(source).toContain('if (nodeWasActive) {');
  });

  it('uses lazy coordinator creation', () => {
    expect(source).toContain(
      'const coordinatorRef = React.useRef<StationarySelectionCoordinator | null>(null);',
    );
    expect(source).toContain('coordinatorRef.current ??= createStationarySelectionCoordinator();');
    expect(source).not.toContain('useRef(createStationarySelectionCoordinator())');
  });

  it('records pointer and touch input with generation validation', () => {
    expect(source).toContain('ctx.recordNode(nodeId, input)');
    expect(source).toContain('onPointerDown: handlePointerDown');
    expect(source).toContain('onTouchStart: handleTouchStart');
    expect(source).toContain('inputState.beginTransaction((nodeId) =>');
    expect(source).toContain('onPointerCancel: handleInteractionCompletion');
    expect(source).toContain('onTouchCancel: handleInteractionCompletion');
  });

  it('uses public element geometry only for web indication measurement', () => {
    expect(source).toContain("Platform.OS === 'web'");
    expect(source).toContain('getBoundingClientRect');
    expect(source).toContain('measureRenderedBoxes(child)');
    expect(source).not.toContain('findNodeHandle');
    expect(source).not.toContain('ReactNativePrivateInterface');
  });

  it('refreshes indication geometry from coalesced public layout events', () => {
    expect(source).toContain('createIndicatorRefreshCoordinator');
    expect(source).toContain("window.addEventListener('scroll', handleScroll, true)");
    expect(source).toContain("window.addEventListener('resize', handleResize)");
    expect(source).toContain('new ResizeObserver(() => requestIndicatorRefresh())');
    expect(source).toContain('createActiveResizeTargetCoordinator(observer)');
    expect(source).toContain('onLayout: requestIndicatorRefresh');
    expect(source).toContain('onTouchMove: requestScrollIndicatorRefresh');
    expect(source).toContain('createIndicatorSettleCoordinator');
    expect(source).not.toContain('measureNextFrame');
  });

  it('unregisters observers and removes web geometry listeners', () => {
    expect(source).toContain("window.removeEventListener('scroll', handleScroll, true)");
    expect(source).toContain("window.removeEventListener('resize', handleResize)");
    expect(source).toContain('resizeTargetCoordinatorRef.current?.disconnect()');
  });
});
