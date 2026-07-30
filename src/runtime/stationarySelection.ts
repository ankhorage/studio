import { ZORA_COMPONENT_REGISTRY } from '@ankhorage/zora';
import React from 'react';
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  Platform,
  type PointerEvent as NativePointerEvent,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import {
  createIndicatorRefreshCoordinator,
  type IndicatorRefreshCoordinator,
} from './indicatorRefreshCoordinator.js';
import type { StationarySelectionCoordinator } from './stationarySelectionCoordinator.js';
import { createStationarySelectionCoordinator } from './stationarySelectionCoordinator.js';
import {
  createStationarySelectionInputState,
  type StationarySelectionInput,
  type StationarySelectionInputState,
} from './stationarySelectionInputState.js';

export type {
  CommitSelectionResult,
  StationarySelectionCoordinator,
  TransactionState,
} from './stationarySelectionCoordinator.js';

interface MeasuredRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface UnsupportedIndicatorRect extends MeasuredRect {
  readonly nodeId: string;
}

type ViewRef = React.ElementRef<typeof View>;
type MeasureUnsupportedNode = () => Promise<MeasuredRect | null>;

interface UnsupportedNodeMeasurement {
  readonly measure: MeasureUnsupportedNode;
  readonly resizeTargets: readonly Element[];
}

interface TrackerContextValue {
  readonly completePendingInteraction: () => void;
  readonly recordNode: (nodeId: string, input: StationarySelectionInput) => void;
  readonly registerUnsupportedNode: (
    nodeId: string,
    measurement: UnsupportedNodeMeasurement,
  ) => () => void;
  readonly requestIndicatorRefresh: () => void;
  readonly requestScrollIndicatorRefresh: () => void;
}

const TrackerContext = React.createContext<TrackerContextValue | null>(null);
const NATIVE_SCROLL_SETTLE_MS = 800;

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

function isWebElementLike(value: unknown): value is WebElementLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'children' in value &&
    'getBoundingClientRect' in value &&
    typeof value.getBoundingClientRect === 'function'
  );
}

function getWebResizeTarget(value: unknown): Element | null {
  return Platform.OS === 'web' && isWebElementLike(value) ? (value as unknown as Element) : null;
}

function getWebDescendantResizeTargets(value: unknown): readonly Element[] {
  if (Platform.OS !== 'web' || !isWebElementLike(value)) {
    return [];
  }

  return Array.from(value.children).flatMap((child) => [
    child as unknown as Element,
    ...getWebDescendantResizeTargets(child),
  ]);
}

function toMeasuredRect(rect: WebRectLike): MeasuredRect {
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function unionRects(rects: readonly MeasuredRect[]): MeasuredRect | null {
  if (rects.length === 0) {
    return null;
  }

  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function measureRenderedBoxes(element: WebElementLike): readonly MeasuredRect[] {
  const rect = toMeasuredRect(element.getBoundingClientRect());
  if (rect.width > 0 && rect.height > 0) {
    return [rect];
  }

  return Array.from(element.children).flatMap((child) => measureRenderedBoxes(child));
}

function measureNativeView(view: ViewRef): Promise<MeasuredRect | null> {
  return new Promise((resolve) => {
    view.measureInWindow((x, y, width, height) => {
      resolve(width > 0 && height > 0 ? { x, y, width, height } : null);
    });
  });
}

function measureRootView(view: ViewRef | null): Promise<MeasuredRect | null> {
  if (!view) {
    return Promise.resolve(null);
  }

  if (Platform.OS === 'web' && isWebElementLike(view)) {
    return Promise.resolve(toMeasuredRect(view.getBoundingClientRect()));
  }

  return measureNativeView(view);
}

function measureUnsupportedView(view: ViewRef | null): Promise<MeasuredRect | null> {
  if (!view) {
    return Promise.resolve(null);
  }

  if (Platform.OS === 'web' && isWebElementLike(view)) {
    return Promise.resolve(
      unionRects(Array.from(view.children).flatMap((child) => measureRenderedBoxes(child))),
    );
  }

  return measureNativeView(view);
}

function areIndicatorRectsEqual(
  left: readonly UnsupportedIndicatorRect[],
  right: readonly UnsupportedIndicatorRect[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((rect, index) => {
    const candidate = right[index];
    if (!candidate) {
      return false;
    }
    return (
      rect.nodeId === candidate.nodeId &&
      Math.abs(rect.x - candidate.x) < 0.5 &&
      Math.abs(rect.y - candidate.y) < 0.5 &&
      Math.abs(rect.width - candidate.width) < 0.5 &&
      Math.abs(rect.height - candidate.height) < 0.5
    );
  });
}

function StudioNodeTouchRecorder(props: {
  readonly nodeId: string | undefined;
  readonly showUnsupportedIndicator: boolean;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const ctx = React.useContext(TrackerContext);
  const nodeIdRef = React.useRef(props.nodeId);
  const unregisterMeasurementRef = React.useRef<(() => void) | null>(null);

  nodeIdRef.current = props.nodeId;

  function recordInteraction(input: StationarySelectionInput): void {
    if (!ctx) {
      return;
    }

    const nodeId = nodeIdRef.current;

    if (!nodeId) {
      return;
    }

    ctx.recordNode(nodeId, input);
  }

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

  function handleTouchStart(event: GestureResponderEvent): void {
    const [changedTouch] = event.nativeEvent.changedTouches;
    recordInteraction({
      kind: 'touch',
      interactionId: event.nativeEvent.timestamp,
      touchId: changedTouch?.identifier ?? event.nativeEvent.identifier,
    });
  }

  function handleInteractionCompletion(): void {
    ctx?.completePendingInteraction();
  }

  function handleLayout(_event: LayoutChangeEvent): void {
    ctx?.requestIndicatorRefresh();
  }

  const setViewRef = React.useCallback(
    (view: ViewRef | null) => {
      unregisterMeasurementRef.current?.();
      unregisterMeasurementRef.current = null;
      if (view && ctx && props.nodeId && props.showUnsupportedIndicator) {
        unregisterMeasurementRef.current = ctx.registerUnsupportedNode(props.nodeId, {
          measure: () => measureUnsupportedView(view),
          resizeTargets: getWebDescendantResizeTargets(view),
        });
      }
    },
    [ctx, props.nodeId, props.showUnsupportedIndicator],
  );

  return React.createElement(
    View,
    {
      collapsable: false,
      ref: setViewRef,
      nativeID: props.nodeId
        ? `studio-runtime-node-${encodeURIComponent(props.nodeId)}`
        : undefined,
      testID:
        props.nodeId && props.showUnsupportedIndicator
          ? `studio-unsupported-recorder-${props.nodeId}`
          : undefined,
      style:
        Platform.OS === 'web' || !props.showUnsupportedIndicator
          ? { display: 'contents' }
          : undefined,
      onLayout: handleLayout,
      onPointerCancel: handleInteractionCompletion,
      onPointerDown: handlePointerDown,
      onPointerUp: handleInteractionCompletion,
      onTouchCancel: handleInteractionCompletion,
      onTouchEnd: handleInteractionCompletion,
      onTouchStart: handleTouchStart,
    },
    props.children,
  );
}

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

  return function wrapNode(args: {
    readonly node: { readonly id?: string; readonly type: string };
    readonly rendered: React.ReactNode;
    readonly isRoot: boolean;
  }): React.ReactNode {
    if (args.isRoot || !args.node.id) {
      return args.rendered;
    }

    const isSupported =
      Object.prototype.hasOwnProperty.call(ZORA_COMPONENT_REGISTRY, args.node.type) ||
      (thirdPartySupport != null &&
        Object.prototype.hasOwnProperty.call(thirdPartySupport, args.node.type) &&
        thirdPartySupport[args.node.type] === true);

    return React.createElement(StudioNodeTouchRecorder, {
      nodeId: args.node.id,
      showUnsupportedIndicator: isEditMode && !isSupported,
      children: args.rendered,
    });
  };
}

function StationaryTapSelector(props: {
  readonly isEditMode: boolean;
  readonly selectedNodeId: string | null;
  readonly selectNode: (id: string | null) => void;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const coordinatorRef = React.useRef<StationarySelectionCoordinator | null>(null);
  const rootViewRef = React.useRef<ViewRef | null>(null);
  const unsupportedNodesRef = React.useRef(new Map<string, Set<UnsupportedNodeMeasurement>>());
  const resizeObserverRef = React.useRef<ResizeObserver | null>(null);
  const [indicatorRects, setIndicatorRects] = React.useState<readonly UnsupportedIndicatorRect[]>(
    [],
  );

  coordinatorRef.current ??= createStationarySelectionCoordinator();

  const coordinator = coordinatorRef.current;

  const isEditModeRef = React.useRef(props.isEditMode);
  const selectedNodeIdRef = React.useRef(props.selectedNodeId);
  const selectNodeRef = React.useRef(props.selectNode);
  const selectionCommitCountRef = React.useRef(0);
  const generationRef = React.useRef(0);
  const inputStateRef = React.useRef<StationarySelectionInputState | null>(null);
  const refreshCoordinatorRef = React.useRef<IndicatorRefreshCoordinator | null>(null);
  const refreshIndicatorRectsRef = React.useRef<() => void>(() => undefined);
  const geometryRevisionRef = React.useRef(0);
  const mountedRef = React.useRef(true);
  const settledScrollRefreshTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  isEditModeRef.current = props.isEditMode;
  selectedNodeIdRef.current = props.selectedNodeId;
  selectNodeRef.current = props.selectNode;

  inputStateRef.current ??= createStationarySelectionInputState({
    hasActiveTransaction: () => generationRef.current !== 0,
    recordActiveNode: (nodeId) => {
      coordinator.recordNode(nodeId, generationRef.current);
    },
  });
  const inputState = inputStateRef.current;

  const requestIndicatorRefresh = React.useCallback(() => {
    geometryRevisionRef.current += 1;
    refreshCoordinatorRef.current ??= createIndicatorRefreshCoordinator(
      () => refreshIndicatorRectsRef.current(),
      {
        request: (callback) => requestAnimationFrame(callback),
        cancel: (frameId) => cancelAnimationFrame(frameId),
      },
    );
    refreshCoordinatorRef.current.requestRefresh();
  }, []);

  const requestScrollIndicatorRefresh = React.useCallback(() => {
    requestIndicatorRefresh();
    if (settledScrollRefreshTimerRef.current !== null) {
      clearTimeout(settledScrollRefreshTimerRef.current);
    }
    settledScrollRefreshTimerRef.current = setTimeout(() => {
      settledScrollRefreshTimerRef.current = null;
      requestIndicatorRefresh();
    }, NATIVE_SCROLL_SETTLE_MS);
  }, [requestIndicatorRefresh]);

  const registerUnsupportedNode = React.useCallback(
    (nodeId: string, measurement: UnsupportedNodeMeasurement) => {
      const measurements = unsupportedNodesRef.current.get(nodeId) ?? new Set();
      measurements.add(measurement);
      unsupportedNodesRef.current.set(nodeId, measurements);
      for (const resizeTarget of measurement.resizeTargets) {
        resizeObserverRef.current?.observe(resizeTarget);
      }
      requestIndicatorRefresh();

      return () => {
        const registeredMeasurements = unsupportedNodesRef.current.get(nodeId);
        if (!registeredMeasurements?.delete(measurement)) {
          return;
        }
        for (const resizeTarget of measurement.resizeTargets) {
          resizeObserverRef.current?.unobserve(resizeTarget);
        }
        if (registeredMeasurements.size === 0) {
          unsupportedNodesRef.current.delete(nodeId);
        }
        requestIndicatorRefresh();
      };
    },
    [requestIndicatorRefresh],
  );

  const contextValue = React.useMemo(
    () => ({
      completePendingInteraction: () => inputState.completePendingInteraction(),
      recordNode: (nodeId: string, input: StationarySelectionInput) => {
        inputState.recordNode(nodeId, input);
      },
      registerUnsupportedNode,
      requestIndicatorRefresh,
      requestScrollIndicatorRefresh,
    }),
    [inputState, registerUnsupportedNode, requestIndicatorRefresh, requestScrollIndicatorRefresh],
  );

  const refreshIndicatorRects = React.useCallback(async () => {
    const geometryRevision = geometryRevisionRef.current;
    if (!isEditModeRef.current || unsupportedNodesRef.current.size === 0) {
      setIndicatorRects((current) => (current.length === 0 ? current : []));
      return;
    }

    const rootRect = await measureRootView(rootViewRef.current);
    if (!rootRect) {
      return;
    }

    const measurements = await Promise.all(
      [...unsupportedNodesRef.current.entries()].map(async ([nodeId, nodeMeasurements]) => {
        const rects = await Promise.all(
          [...nodeMeasurements].map((measurement) => measurement.measure()),
        );
        return {
          nodeId,
          rect: unionRects(rects.filter((rect): rect is MeasuredRect => rect !== null)),
        };
      }),
    );
    const nextRects = measurements
      .flatMap(({ nodeId, rect }) =>
        rect
          ? [
              {
                nodeId,
                x: rect.x - rootRect.x,
                y: rect.y - rootRect.y,
                width: rect.width,
                height: rect.height,
              },
            ]
          : [],
      )
      .sort((left, right) => left.nodeId.localeCompare(right.nodeId));

    if (!mountedRef.current || geometryRevision !== geometryRevisionRef.current) {
      return;
    }

    setIndicatorRects((current) =>
      areIndicatorRectsEqual(current, nextRects) ? current : nextRects,
    );
  }, []);
  refreshIndicatorRectsRef.current = () => {
    void refreshIndicatorRects();
  };

  React.useEffect(() => {
    requestIndicatorRefresh();
  }, [props.isEditMode, requestIndicatorRefresh]);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      geometryRevisionRef.current += 1;
      refreshCoordinatorRef.current?.cancelPendingRefresh();
      if (settledScrollRefreshTimerRef.current !== null) {
        clearTimeout(settledScrollRefreshTimerRef.current);
        settledScrollRefreshTimerRef.current = null;
      }
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
    resizeObserverRef.current = observer;
    const rootResizeTarget = getWebResizeTarget(rootViewRef.current);
    if (rootResizeTarget) {
      observer?.observe(rootResizeTarget);
    }
    for (const measurements of unsupportedNodesRef.current.values()) {
      for (const measurement of measurements) {
        for (const resizeTarget of measurement.resizeTargets) {
          observer?.observe(resizeTarget);
        }
      }
    }

    const handleScroll = () => requestIndicatorRefresh();
    const handleResize = () => requestIndicatorRefresh();
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
      observer?.disconnect();
      if (resizeObserverRef.current === observer) {
        resizeObserverRef.current = null;
      }
    };
  }, [requestIndicatorRefresh]);

  const setRootViewRef = React.useCallback(
    (view: ViewRef | null) => {
      const previousResizeTarget = getWebResizeTarget(rootViewRef.current);
      if (previousResizeTarget) {
        resizeObserverRef.current?.unobserve(previousResizeTarget);
      }
      rootViewRef.current = view;
      const nextResizeTarget = getWebResizeTarget(view);
      if (nextResizeTarget) {
        resizeObserverRef.current?.observe(nextResizeTarget);
      }
      requestIndicatorRefresh();
    },
    [requestIndicatorRefresh],
  );

  const tapGesture = React.useMemo(() => {
    return Gesture.Tap()
      .maxDeltaX(5)
      .maxDeltaY(5)
      .maxDuration(500)
      .runOnJS(true)
      .onBegin(() => {
        generationRef.current = coordinator.beginTransaction();
        inputState.beginTransaction((nodeId) => {
          coordinator.recordNode(nodeId, generationRef.current);
        });
      })
      .onEnd((_event, success) => {
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
      })
      .onFinalize(() => {
        coordinator.clearTransaction(generationRef.current);
        generationRef.current = 0;
        inputState.clear();
      });
  }, [coordinator, inputState]);

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
        ...indicatorRects.map((rect) =>
          React.createElement(View, {
            key: rect.nodeId,
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
      ),
    ),
  );
}

export { StationaryTapSelector };
