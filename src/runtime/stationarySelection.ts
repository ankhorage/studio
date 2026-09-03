import type { UiNode } from '@ankhorage/contracts';
import { useZoraTheme, ZORA_COMPONENT_REGISTRY } from '@ankhorage/zora';
import React from 'react';
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  Platform,
  type PointerEvent as NativePointerEvent,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { resolveCanvasDragSession } from '../canvasDragModel.js';
import type { NodePlacement, StudioComponentMetaRegistry } from '../index.js';
import { StudioCanvasDndOverlay } from '../ui/canvas/StudioCanvasDndOverlay.js';
import {
  createIndicatorRefreshCoordinator,
  type IndicatorRefreshCoordinator,
} from './indicatorRefreshCoordinator.js';
import {
  createIndicatorSettleCoordinator,
  type IndicatorSettleCoordinator,
} from './indicatorSettleCoordinator.js';
import {
  type ActiveResizeTargetCoordinator,
  createActiveResizeTargetCoordinator,
  createNativeRuntimeNodeMeasurement,
  createSelectedIndicatorViewProps,
  getActiveRuntimeNodeMeasurements,
  hasActiveRuntimeNodeMeasurements,
  type MeasuredRect,
  measureNativeRuntimeNodeView,
  measureRuntimeNodeIndicators,
  type RuntimeNodeIndicatorRect,
  type RuntimeNodeMeasurement,
  runtimeNodeMeasurementChangeAffectsActiveIndicators,
  shouldRenderSelectedNodeChrome,
  unionMeasuredRects,
} from './runtimeNodeMeasurement.js';
import type { StationarySelectionCoordinator } from './stationarySelectionCoordinator.js';
import { createStationarySelectionCoordinator } from './stationarySelectionCoordinator.js';
import {
  createStationarySelectionInputState,
  type StationarySelectionInput,
  type StationarySelectionInputState,
} from './stationarySelectionInputState.js';

type ViewRef = React.ElementRef<typeof View>;

interface TrackerContextValue {
  readonly completePendingInteraction: () => void;
  readonly recordNode: (nodeId: string, input: StationarySelectionInput) => void;
  readonly registerRuntimeNode: (nodeId: string, measurement: RuntimeNodeMeasurement) => () => void;
  readonly requestIndicatorRefresh: () => void;
  readonly requestScrollIndicatorRefresh: () => void;
}

const TrackerContext = React.createContext<TrackerContextValue | null>(null);
const NATIVE_SETTLE_INTERVAL_MS = 60;
const NATIVE_SETTLE_MAX_SAMPLES = 80;
const NATIVE_SETTLE_STABLE_SAMPLE_COUNT = 3;

interface RuntimeNodeMeasurementContextValue {
  readonly registerView: (view: ViewRef) => () => void;
  readonly requestRefresh: () => void;
}

const RuntimeNodeMeasurementContext =
  React.createContext<RuntimeNodeMeasurementContextValue | null>(null);

interface WebRectLike {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

interface WebElementLike {
  readonly children: ArrayLike<WebElementLike>;
  getBoundingClientRect(): WebRectLike;
}

/***
 * Detect a DOM-like element that exposes child traversal and bounding-rectangle measurement.
 * @utility @ankhorage/utility/web
 */
function isWebElementLike(value: unknown): value is WebElementLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'children' in value &&
    'getBoundingClientRect' in value &&
    typeof value.getBoundingClientRect === 'function'
  );
}

/***
 * Resolve an unknown React-Native view value to a DOM resize target only on the web platform.
 * @utility @ankhorage/utility/react-native/web
 */
function getWebResizeTarget(value: unknown): Element | null {
  return Platform.OS === 'web' && isWebElementLike(value) ? (value as unknown as Element) : null;
}

/***
 * Recursively collect every descendant DOM resize target from a DOM-like value when running on web.
 * @utility @ankhorage/utility/web
 */
function getWebDescendantResizeTargets(value: unknown): readonly Element[] {
  if (Platform.OS !== 'web' || !isWebElementLike(value)) {
    return [];
  }

  return Array.from(value.children).flatMap((child) => [
    child as unknown as Element,
    ...getWebDescendantResizeTargets(child),
  ]);
}

/***
 * Convert a left/top/width/height rectangle into the package's x/y measured-rectangle shape.
 * @utility @ankhorage/utility/geometry
 */
function toMeasuredRect(rect: WebRectLike): MeasuredRect {
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

/***
 * Measure a DOM-like element, falling through zero-area wrappers to the rendered descendant boxes they contain.
 * @utility @ankhorage/utility/web
 */
function measureRenderedBoxes(element: WebElementLike): readonly MeasuredRect[] {
  const rect = toMeasuredRect(element.getBoundingClientRect());
  if (rect.width > 0 && rect.height > 0) {
    return [rect];
  }

  return Array.from(element.children).flatMap((child) => measureRenderedBoxes(child));
}

/***
 * Measure a React-Native view in window coordinates across web and native, returning null for a missing view.
 * @utility @ankhorage/utility/react-native/measurement
 */
function measureRootView(view: ViewRef | null): Promise<MeasuredRect | null> {
  if (!view) {
    return Promise.resolve(null);
  }

  if (Platform.OS === 'web' && isWebElementLike(view)) {
    return Promise.resolve(toMeasuredRect(view.getBoundingClientRect()));
  }

  return measureNativeRuntimeNodeView(view);
}

/***
 * Measure the rendered descendant boxes of a web view and return their union rectangle.
 * @utility @ankhorage/utility/web
 */
function measureRuntimeNodeWebView(view: ViewRef | null): Promise<MeasuredRect | null> {
  if (!view) {
    return Promise.resolve(null);
  }

  if (isWebElementLike(view)) {
    return Promise.resolve(
      unionMeasuredRects(Array.from(view.children).flatMap((child) => measureRenderedBoxes(child))),
    );
  }

  return Promise.resolve(null);
}

/***
 * Measure one authored web view directly and treat zero-area geometry as absent.
 * @utility @ankhorage/utility/web
 */
function measureAuthoredWebView(view: ViewRef): Promise<MeasuredRect | null> {
  if (!isWebElementLike(view)) {
    return Promise.resolve(null);
  }

  const rect = toMeasuredRect(view.getBoundingClientRect());
  return Promise.resolve(rect.width > 0 && rect.height > 0 ? rect : null);
}

/***
 * Compare ordered indicator-rectangle collections by identity flags and sub-pixel geometry tolerance.
 * @utility @ankhorage/utility/geometry
 */
function areIndicatorRectsEqual(
  left: readonly RuntimeNodeIndicatorRect[],
  right: readonly RuntimeNodeIndicatorRect[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((rect, index) => {
    const candidate = right.at(index);
    if (!candidate) {
      return false;
    }
    return (
      rect.nodeId === candidate.nodeId &&
      rect.showUnsupportedIndicator === candidate.showUnsupportedIndicator &&
      Math.abs(rect.x - candidate.x) < 0.5 &&
      Math.abs(rect.y - candidate.y) < 0.5 &&
      Math.abs(rect.width - candidate.width) < 0.5 &&
      Math.abs(rect.height - candidate.height) < 0.5
    );
  });
}

/***
 * Expose the measurement ref/layout callbacks used by Studio-rendered unsupported nodes.
 * @todo Move this Studio React measurement hook to the selection/canvas app edge; it composes reusable measurement primitives but is not generic runtime behavior.
 */
export function useStudioUnsupportedNodeMeasurement(): {
  readonly onLayout: (_event: LayoutChangeEvent) => void;
  readonly ref: (view: ViewRef | null) => void;
} {
  const context = React.useContext(RuntimeNodeMeasurementContext);
  const unregisterRef = React.useRef<(() => void) | null>(null);

  /*** Replace the currently registered unsupported-node view and unregister the previous measurement. */
  const setViewRef = React.useCallback(
    (view: ViewRef | null) => {
      unregisterRef.current?.();
      unregisterRef.current = view && context ? context.registerView(view) : null;
    },
    [context],
  );

  React.useEffect(
    () => () => {
      unregisterRef.current?.();
      unregisterRef.current = null;
    },
    [],
  );

  /*** Request a geometry refresh after React Native reports a layout change. */
  const onLayout = React.useCallback(
    (_event: LayoutChangeEvent) => {
      context?.requestRefresh();
    },
    [context],
  );

  return React.useMemo(() => ({ onLayout, ref: setViewRef }), [onLayout, setViewRef]);
}

/***
 * Wrap one rendered Studio runtime node so pointer/touch interactions and geometry can be recorded for stationary selection and unsupported-node indicators.
 * @todo Keep this React-Native gesture/measurement adapter at the Studio selection/canvas app edge instead of generic `runtime/` ownership.
 */
function StudioNodeTouchRecorder(props: {
  readonly nodeId: string | undefined;
  readonly recordSelection: boolean;
  readonly showUnsupportedIndicator: boolean;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const ctx = React.useContext(TrackerContext);
  const unregisterMeasurementRef = React.useRef<(() => void) | null>(null);
  const { nodeId, recordSelection, showUnsupportedIndicator } = props;

  /*** Record one normalized pointer/touch interaction for this node when selection recording is enabled. */
  function recordInteraction(input: StationarySelectionInput): void {
    if (!ctx || !recordSelection || !nodeId) {
      return;
    }

    ctx.recordNode(nodeId, input);
  }

  /*** Normalize a React-Native pointer-down event into the stationary-selection pointer input contract. */
  function handlePointerDown(event: NativePointerEvent): void {
    recordInteraction({
      kind: 'pointer',
      button: event.nativeEvent.button,
      interactionId: event.timeStamp,
      isPrimary: event.nativeEvent.isPrimary,
      pointerId: event.nativeEvent.pointerId,
      pointerType: event.nativeEvent.pointerType,
    });
  }

  /*** Normalize a React-Native touch-start event into the stationary-selection touch input contract. */
  function handleTouchStart(event: GestureResponderEvent): void {
    const [changedTouch] = event.nativeEvent.changedTouches;
    recordInteraction({
      kind: 'touch',
      interactionId: event.nativeEvent.timestamp,
      touchId: changedTouch?.identifier ?? event.nativeEvent.identifier,
    });
  }

  /*** Complete the currently pending pointer/touch interaction when the platform signals end or cancellation. */
  function handleInteractionCompletion(): void {
    ctx?.completePendingInteraction();
  }

  /*** Request fresh indicator geometry after this recorder's layout changes. */
  function handleLayout(_event: LayoutChangeEvent): void {
    ctx?.requestIndicatorRefresh();
  }

  /*** Register the recorder view as a runtime-node measurement source and unregister the previous view. */
  const setViewRef = React.useCallback(
    (view: ViewRef | null) => {
      unregisterMeasurementRef.current?.();
      unregisterMeasurementRef.current = null;
      if (view && ctx && nodeId) {
        unregisterMeasurementRef.current = ctx.registerRuntimeNode(
          nodeId,
          Platform.OS === 'web'
            ? {
                getResizeTargets: () => getWebDescendantResizeTargets(view),
                measure: () => measureRuntimeNodeWebView(view),
                showUnsupportedIndicator,
                source: 'runtime-recorder',
              }
            : {
                measure: () => measureNativeRuntimeNodeView(view),
                showUnsupportedIndicator,
                source: 'runtime-recorder',
              },
        );
      }
    },
    [ctx, nodeId, showUnsupportedIndicator],
  );

  /*** Build the child measurement context used by authored descendants rendered inside this runtime-node recorder. */
  const measurementContext = React.useMemo<RuntimeNodeMeasurementContextValue | null>(() => {
    if (!ctx || !nodeId) {
      return null;
    }

    return {
      registerView: (view) => {
        if (Platform.OS !== 'web') {
          return ctx.registerRuntimeNode(
            nodeId,
            createNativeRuntimeNodeMeasurement(view, showUnsupportedIndicator),
          );
        }

        return ctx.registerRuntimeNode(nodeId, {
          getResizeTargets: () => {
            const rootTarget = getWebResizeTarget(view);
            return rootTarget
              ? [rootTarget, ...getWebDescendantResizeTargets(view)]
              : getWebDescendantResizeTargets(view);
          },
          measure: () => measureAuthoredWebView(view),
          showUnsupportedIndicator,
          source: 'authored-root',
        });
      },
      requestRefresh: ctx.requestIndicatorRefresh,
    };
  }, [ctx, nodeId, showUnsupportedIndicator]);

  return React.createElement(
    RuntimeNodeMeasurementContext.Provider,
    { value: measurementContext },
    React.createElement(
      View,
      {
        ref: setViewRef,
        nativeID:
          Platform.OS === 'web' && nodeId
            ? `studio-runtime-node-${encodeURIComponent(nodeId)}`
            : undefined,
        testID:
          Platform.OS === 'web' && nodeId && showUnsupportedIndicator
            ? `studio-unsupported-recorder-${nodeId}`
            : undefined,
        style: { display: 'contents' },
        onLayout: handleLayout,
        onPointerCancel: handleInteractionCompletion,
        onPointerDown: handlePointerDown,
        onPointerUp: handleInteractionCompletion,
        onTouchCancel: handleInteractionCompletion,
        onTouchEnd: handleInteractionCompletion,
        onTouchStart: handleTouchStart,
      },
      props.children,
    ),
  );
}

/***
 * Create Studio's runtime-node wrapper that records stationary selection and unsupported-node measurement around eligible rendered nodes.
 * @todo Move this Studio/ZORA selection wrapper to the selection/canvas app edge; it is package integration rather than generic runtime policy.
 */
export function createStudioStationarySelectionWrapNode(options?: {
  readonly previewMode?: boolean;
  readonly thirdPartySupport?: Readonly<Record<string, true>>;
}): (args: {
  readonly node: { readonly id?: string; readonly type: string };
  readonly rendered: React.ReactNode;
  readonly isRoot: boolean;
}) => React.ReactNode {
  const { previewMode, thirdPartySupport } = options ?? {};
  const isEditMode = previewMode !== true;

  /*** Wrap one eligible rendered node while preserving unsupported/root nodes that should not be instrumented. */
  return function wrapNode(args: {
    readonly node: { readonly id?: string; readonly type: string };
    readonly rendered: React.ReactNode;
    readonly isRoot: boolean;
  }): React.ReactNode {
    if (!args.node.id) {
      return args.rendered;
    }

    if (args.isRoot && Platform.OS !== 'web') {
      return args.rendered;
    }

    const isSupported =
      Object.prototype.hasOwnProperty.call(ZORA_COMPONENT_REGISTRY, args.node.type) ||
      (thirdPartySupport != null &&
        Object.prototype.hasOwnProperty.call(thirdPartySupport, args.node.type) &&
        thirdPartySupport[args.node.type] === true);

    return React.createElement(StudioNodeTouchRecorder, {
      nodeId: args.node.id,
      recordSelection: !args.isRoot,
      showUnsupportedIndicator: isEditMode && !args.isRoot && !isSupported,
      children: args.rendered,
    });
  };
}

export interface StudioCanvasInteractionAdapter {
  readonly activeDragNodeId: string | null;
  readonly componentMeta: StudioComponentMetaRegistry;
  readonly moveNodeToPlacement: (nodeId: string, placement: NodePlacement) => boolean;
  readonly rootNode: UiNode | null;
  readonly setActiveDragNodeId: (nodeId: string | null) => void;
}

/***
 * Coordinate Studio stationary tap selection, drag interaction, node measurement, indicator refresh, and selected/unsupported chrome rendering.
 * @todo Split this large React composition into the Studio selection/canvas app edge; the reusable coordinators and measurement primitives should remain independent owners.
 */
function StationaryTapSelector(props: {
  readonly isEditMode: boolean;
  readonly selectedNodeId: string | null;
  readonly selectNode: (id: string | null) => void;
  readonly canvasInteraction?: StudioCanvasInteractionAdapter;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const { theme } = useZoraTheme();
  const { canvasInteraction } = props;
  const coordinatorRef = React.useRef<StationarySelectionCoordinator | null>(null);
  const rootViewRef = React.useRef<ViewRef | null>(null);
  const runtimeNodesRef = React.useRef(new Map<string, Set<RuntimeNodeMeasurement>>());
  const resizeTargetCoordinatorRef = React.useRef<ActiveResizeTargetCoordinator<Element> | null>(
    null,
  );
  const [indicatorRects, setIndicatorRects] = React.useState<readonly RuntimeNodeIndicatorRect[]>(
    [],
  );
  const latestIndicatorRectsRef = React.useRef<readonly RuntimeNodeIndicatorRect[]>([]);

  coordinatorRef.current ??= createStationarySelectionCoordinator();

  const coordinator = coordinatorRef.current;

  const isEditModeRef = React.useRef(props.isEditMode);
  const selectedNodeIdRef = React.useRef(props.selectedNodeId);
  const measurementSelectedNodeIdRef = React.useRef<string | null>(null);
  const activeDragNodeIdRef = React.useRef<string | null>(null);
  const selectNodeRef = React.useRef(props.selectNode);
  const selectionCommitCountRef = React.useRef(0);
  const generationRef = React.useRef(0);
  const inputStateRef = React.useRef<StationarySelectionInputState | null>(null);
  const refreshCoordinatorRef = React.useRef<IndicatorRefreshCoordinator | null>(null);
  const settleCoordinatorRef = React.useRef<IndicatorSettleCoordinator | null>(null);
  const refreshIndicatorRectsRef = React.useRef<
    () => Promise<readonly RuntimeNodeIndicatorRect[] | null>
  >(() => Promise.resolve(null));
  const geometryRevisionRef = React.useRef(0);
  const mountedRef = React.useRef(true);

  isEditModeRef.current = props.isEditMode;
  selectedNodeIdRef.current = props.selectedNodeId;
  const shouldRenderSelectedChrome = shouldRenderSelectedNodeChrome(
    Platform.OS,
    props.isEditMode,
    props.selectedNodeId,
  );
  const selectedIndicatorNodeId = shouldRenderSelectedChrome ? props.selectedNodeId : null;
  const measurementSelectedNodeId = props.isEditMode ? props.selectedNodeId : null;
  const requestedActiveDragNodeId = canvasInteraction?.activeDragNodeId ?? null;
  const canvasDragSession = resolveCanvasDragSession({
    activeDragNodeId: requestedActiveDragNodeId,
    isEditMode: props.isEditMode,
    rootNode: canvasInteraction?.rootNode ?? null,
    selectedNodeId: props.selectedNodeId,
  });
  const { activeDragNodeId } = canvasDragSession;
  const setActiveDragNodeId = canvasInteraction?.setActiveDragNodeId;
  measurementSelectedNodeIdRef.current = measurementSelectedNodeId;
  activeDragNodeIdRef.current = activeDragNodeId;
  selectNodeRef.current = props.selectNode;

  inputStateRef.current ??= createStationarySelectionInputState({
    hasActiveTransaction: () => generationRef.current !== 0,
    recordActiveNode: (nodeId) => {
      coordinator.recordNode(nodeId, generationRef.current);
    },
  });
  const inputState = inputStateRef.current;

  /*** Coalesce runtime-node geometry refresh requests through requestAnimationFrame. */
  const requestIndicatorRefresh = React.useCallback(() => {
    refreshCoordinatorRef.current ??= createIndicatorRefreshCoordinator(
      () => {
        void refreshIndicatorRectsRef.current();
      },
      {
        request: (callback) => requestAnimationFrame(callback),
        cancel: (frameId) => cancelAnimationFrame(frameId),
      },
    );
    refreshCoordinatorRef.current.requestRefresh();
  }, []);

  /*** Refresh immediately for scrolling and trigger native settle sampling while geometry can continue moving after the event. */
  const requestScrollIndicatorRefresh = React.useCallback(() => {
    requestIndicatorRefresh();
    if (
      Platform.OS === 'web' ||
      !hasActiveRuntimeNodeMeasurements(
        runtimeNodesRef.current,
        isEditModeRef.current,
        measurementSelectedNodeIdRef.current,
        activeDragNodeIdRef.current,
      )
    ) {
      return;
    }
    settleCoordinatorRef.current ??= createIndicatorSettleCoordinator<
      readonly RuntimeNodeIndicatorRect[],
      ReturnType<typeof setTimeout>
    >({
      areEqual: areIndicatorRectsEqual,
      intervalMs: NATIVE_SETTLE_INTERVAL_MS,
      maxSamples: NATIVE_SETTLE_MAX_SAMPLES,
      sample: () => refreshIndicatorRectsRef.current(),
      scheduler: {
        cancel: (handle) => clearTimeout(handle),
        schedule: (callback, delayMs) => setTimeout(callback, delayMs),
      },
      stableSampleCount: NATIVE_SETTLE_STABLE_SAMPLE_COUNT,
    });
    settleCoordinatorRef.current.trigger();
  }, [requestIndicatorRefresh]);

  /*** Synchronize the web ResizeObserver target set with currently active node measurements and the canvas root. */
  const syncActiveResizeTargets = React.useCallback(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    const activeMeasurements = getActiveRuntimeNodeMeasurements(
      runtimeNodesRef.current,
      isEditModeRef.current,
      measurementSelectedNodeIdRef.current,
      activeDragNodeIdRef.current,
    );
    const rootTarget = getWebResizeTarget(rootViewRef.current);
    resizeTargetCoordinatorRef.current?.sync(
      activeMeasurements,
      activeMeasurements.length > 0 && rootTarget ? [rootTarget] : [],
    );
  }, []);

  /*** Register one runtime-node measurement and return an unregister callback that updates active observation/refresh state. */
  const registerRuntimeNode = React.useCallback(
    (nodeId: string, measurement: RuntimeNodeMeasurement) => {
      const measurements = runtimeNodesRef.current.get(nodeId) ?? new Set();
      measurements.add(measurement);
      runtimeNodesRef.current.set(nodeId, measurements);
      const nodeIsActive = runtimeNodeMeasurementChangeAffectsActiveIndicators({
        isEditMode: isEditModeRef.current,
        measurements,
        nodeId,
        selectedNodeId: measurementSelectedNodeIdRef.current,
        activeDragNodeId: activeDragNodeIdRef.current,
      });
      if (nodeIsActive) {
        syncActiveResizeTargets();
        requestIndicatorRefresh();
      }

      return () => {
        const registeredMeasurements = runtimeNodesRef.current.get(nodeId);
        if (!registeredMeasurements) {
          return;
        }
        const nodeWasActive = runtimeNodeMeasurementChangeAffectsActiveIndicators({
          isEditMode: isEditModeRef.current,
          measurements: registeredMeasurements,
          nodeId,
          selectedNodeId: measurementSelectedNodeIdRef.current,
          activeDragNodeId: activeDragNodeIdRef.current,
        });
        if (!registeredMeasurements.delete(measurement)) {
          return;
        }
        if (registeredMeasurements.size === 0) {
          runtimeNodesRef.current.delete(nodeId);
        }
        if (nodeWasActive) {
          syncActiveResizeTargets();
          if (
            !hasActiveRuntimeNodeMeasurements(
              runtimeNodesRef.current,
              isEditModeRef.current,
              measurementSelectedNodeIdRef.current,
              activeDragNodeIdRef.current,
            )
          ) {
            settleCoordinatorRef.current?.cancel();
          }
          requestIndicatorRefresh();
        }
      };
    },
    [requestIndicatorRefresh, syncActiveResizeTargets],
  );

  /*** Memoize the tracker-context adapter exposed to descendant runtime node recorders. */
  const contextValue = React.useMemo(
    () => ({
      completePendingInteraction: () => inputState.completePendingInteraction(),
      recordNode: (nodeId: string, input: StationarySelectionInput) => {
        inputState.recordNode(nodeId, input);
      },
      registerRuntimeNode,
      requestIndicatorRefresh,
      requestScrollIndicatorRefresh,
    }),
    [inputState, registerRuntimeNode, requestIndicatorRefresh, requestScrollIndicatorRefresh],
  );

  /*** Measure active runtime nodes, reject stale async results, and commit changed indicator rectangles. */
  const refreshIndicatorRects = React.useCallback(async (): Promise<
    readonly RuntimeNodeIndicatorRect[] | null
  > => {
    const geometryRevision = ++geometryRevisionRef.current;
    if (
      !hasActiveRuntimeNodeMeasurements(
        runtimeNodesRef.current,
        isEditModeRef.current,
        measurementSelectedNodeIdRef.current,
        activeDragNodeIdRef.current,
      )
    ) {
      latestIndicatorRectsRef.current = [];
      setIndicatorRects((current) => (current.length === 0 ? current : []));
      return null;
    }

    const rootRect = await measureRootView(rootViewRef.current);
    if (!rootRect) {
      return latestIndicatorRectsRef.current;
    }

    const nextRects = await measureRuntimeNodeIndicators({
      isEditMode: isEditModeRef.current,
      activeDragNodeId: activeDragNodeIdRef.current,
      canvasRootNodeId: canvasInteraction?.rootNode?.id,
      rootRect,
      runtimeNodes: runtimeNodesRef.current,
      selectedNodeId: measurementSelectedNodeIdRef.current,
    });

    if (!mountedRef.current || geometryRevision !== geometryRevisionRef.current) {
      return mountedRef.current ? latestIndicatorRectsRef.current : null;
    }

    latestIndicatorRectsRef.current = nextRects;
    setIndicatorRects((current) =>
      areIndicatorRectsEqual(current, nextRects) ? current : nextRects,
    );
    return nextRects;
  }, [canvasInteraction?.rootNode?.id]);
  refreshIndicatorRectsRef.current = refreshIndicatorRects;

  React.useEffect(() => {
    if (
      !hasActiveRuntimeNodeMeasurements(
        runtimeNodesRef.current,
        props.isEditMode,
        measurementSelectedNodeId,
        activeDragNodeId,
      )
    ) {
      settleCoordinatorRef.current?.cancel();
    }
    syncActiveResizeTargets();
    requestIndicatorRefresh();
  }, [
    activeDragNodeId,
    measurementSelectedNodeId,
    props.isEditMode,
    requestIndicatorRefresh,
    syncActiveResizeTargets,
  ]);

  React.useEffect(() => {
    if (canvasDragSession.shouldReset) {
      setActiveDragNodeId?.(null);
    }
  }, [canvasDragSession.shouldReset, setActiveDragNodeId]);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      geometryRevisionRef.current += 1;
      refreshCoordinatorRef.current?.cancelPendingRefresh();
      settleCoordinatorRef.current?.cancel();
    };
  }, []);

  React.useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    const observer =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => requestIndicatorRefresh())
        : null;
    resizeTargetCoordinatorRef.current = observer
      ? createActiveResizeTargetCoordinator(observer)
      : null;
    syncActiveResizeTargets();

    /*** Request updated indicator geometry after any captured web scroll. */
    const handleScroll = () => requestIndicatorRefresh();
    /*** Request updated indicator geometry after a web viewport resize. */
    const handleResize = () => requestIndicatorRefresh();
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
      resizeTargetCoordinatorRef.current?.disconnect();
      resizeTargetCoordinatorRef.current = null;
    };
  }, [requestIndicatorRefresh, syncActiveResizeTargets]);

  /*** Store the current canvas root view and synchronize/refresh geometry whenever the ref changes. */
  const setRootViewRef = React.useCallback(
    (view: ViewRef | null) => {
      rootViewRef.current = view;
      syncActiveResizeTargets();
      requestIndicatorRefresh();
    },
    [requestIndicatorRefresh, syncActiveResizeTargets],
  );

  /*** Begin a new stationary-selection transaction and replay any pending recorded node path into it. */
  const handleTapBegin = React.useCallback(() => {
    generationRef.current = coordinator.beginTransaction();
    inputState.beginTransaction((nodeId) => {
      coordinator.recordNode(nodeId, generationRef.current);
    });
  }, [coordinator, inputState]);

  /*** Commit a successful tap transaction to the current Studio selection exactly once. */
  const handleTapEnd = React.useCallback(
    (_event: unknown, success: boolean) => {
      if (!success) {
        return;
      }

      coordinator.commitSelection(
        isEditModeRef.current,
        selectedNodeIdRef.current,
        (nodeId) => {
          selectionCommitCountRef.current += 1;
          selectNodeRef.current(nodeId);
        },
        generationRef.current,
      );
    },
    [coordinator],
  );

  /*** Finalize tap handling by clearing the active generation and buffered interaction path. */
  const handleTapFinalize = React.useCallback(() => {
    coordinator.clearTransaction(generationRef.current);
    generationRef.current = 0;
    inputState.clear();
  }, [coordinator, inputState]);

  /*** Build the native tap gesture that bounds stationary-selection movement/duration and forwards lifecycle callbacks to JavaScript. */
  const tapGesture = React.useMemo(() => {
    const gesture = Gesture.Tap().maxDeltaX(5).maxDeltaY(5).maxDuration(500).runOnJS(true);
    gesture.onBegin(handleTapBegin);
    gesture.onEnd(handleTapEnd);
    gesture.onFinalize(handleTapFinalize);
    return gesture;
  }, [handleTapBegin, handleTapEnd, handleTapFinalize]);

  React.useEffect(() => {
    coordinator.clearTransaction();
    generationRef.current = 0;
    inputState.clear();
  }, [props.isEditMode, coordinator, inputState]);

  const selectionStateId = [
    'studio-stationary-selection-root',
    props.isEditMode ? 'edit' : 'preview',
    encodeURIComponent(props.selectedNodeId ?? 'none'),
    String(selectionCommitCountRef.current),
  ].join(':');

  return React.createElement(
    TrackerContext.Provider,
    { value: contextValue },
    React.createElement(
      GestureDetector,
      { gesture: tapGesture },
      React.createElement(
        View,
        {
          ref: setRootViewRef,
          nativeID: selectionStateId,
          onLayout: requestIndicatorRefresh,
          onTouchMove: requestScrollIndicatorRefresh,
          testID: 'studio-stationary-selection-root',
          style: { flex: 1, position: 'relative' },
        },
        props.children,
        props.isEditMode && canvasInteraction
          ? React.createElement(StudioCanvasDndOverlay, {
              key: 'studio-canvas-dnd-overlay',
              activeDragNodeId,
              componentMeta: canvasInteraction.componentMeta,
              indicatorRects,
              moveNodeToPlacement: canvasInteraction.moveNodeToPlacement,
              rootNode: canvasInteraction.rootNode,
              selectedNodeId: props.selectedNodeId,
              setActiveDragNodeId: canvasInteraction.setActiveDragNodeId,
            })
          : null,
        ...(props.isEditMode
          ? indicatorRects.filter((rect) => rect.showUnsupportedIndicator)
          : []
        ).map((rect) =>
          React.createElement(View, {
            key: `unsupported:${rect.nodeId}`,
            nativeID: `studio-unsupported-indicator-${encodeURIComponent(rect.nodeId)}`,
            testID: `studio-unsupported-indicator-${rect.nodeId}`,
            pointerEvents: 'none',
            style: {
              position: 'absolute',
              left: rect.x,
              top: rect.y,
              width: rect.width,
              height: rect.height,
              borderWidth: 1,
              borderColor: '#ef4444',
              borderStyle: 'dashed',
            },
          }),
        ),
        ...(shouldRenderSelectedChrome
          ? indicatorRects.filter((rect) => rect.nodeId === selectedIndicatorNodeId)
          : []
        ).map((rect) =>
          React.createElement(View, {
            key: `selected:${rect.nodeId}`,
            nativeID: `studio-selected-indicator-${encodeURIComponent(rect.nodeId)}`,
            testID: `studio-selected-indicator-${rect.nodeId}`,
            ...createSelectedIndicatorViewProps(rect, theme.semantics.action.primary.base),
          }),
        ),
      ),
    ),
  );
}

export { StationaryTapSelector };
