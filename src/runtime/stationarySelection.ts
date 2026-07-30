import { ZORA_COMPONENT_REGISTRY } from '@ankhorage/zora';
import React from 'react';
import { Platform, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import type { StationarySelectionCoordinator } from './stationarySelectionCoordinator.js';
import { createStationarySelectionCoordinator } from './stationarySelectionCoordinator.js';

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

interface TrackerContextValue {
  readonly recordNode: (nodeId: string) => void;
  readonly registerUnsupportedNode: (nodeId: string, measure: MeasureUnsupportedNode) => () => void;
}

const TrackerContext = React.createContext<TrackerContextValue | null>(null);

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

  function handleInteractionStart(): void {
    if (!ctx) {
      return;
    }

    const nodeId = nodeIdRef.current;

    if (!nodeId) {
      return;
    }

    ctx.recordNode(nodeId);
  }

  const setViewRef = React.useCallback(
    (view: ViewRef | null) => {
      unregisterMeasurementRef.current?.();
      unregisterMeasurementRef.current = null;
      if (view && ctx && props.nodeId && props.showUnsupportedIndicator) {
        unregisterMeasurementRef.current = ctx.registerUnsupportedNode(props.nodeId, () =>
          measureUnsupportedView(view),
        );
      }
    },
    [ctx, props.nodeId, props.showUnsupportedIndicator],
  );

  return React.createElement(
    View,
    {
      ref: setViewRef,
      nativeID: props.nodeId
        ? `studio-runtime-node-${encodeURIComponent(props.nodeId)}`
        : undefined,
      testID:
        props.nodeId && props.showUnsupportedIndicator
          ? `studio-unsupported-recorder-${props.nodeId}`
          : undefined,
      style: { display: 'contents' },
      onPointerDown: handleInteractionStart,
      onTouchStart: handleInteractionStart,
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
  const unsupportedNodesRef = React.useRef(new Map<string, Set<MeasureUnsupportedNode>>());
  const [unsupportedNodeVersion, setUnsupportedNodeVersion] = React.useState(0);
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
  const pendingNodeIdsRef = React.useRef<string[]>([]);

  isEditModeRef.current = props.isEditMode;
  selectedNodeIdRef.current = props.selectedNodeId;
  selectNodeRef.current = props.selectNode;

  const registerUnsupportedNode = React.useCallback(
    (nodeId: string, measure: MeasureUnsupportedNode) => {
      const measurements = unsupportedNodesRef.current.get(nodeId) ?? new Set();
      measurements.add(measure);
      unsupportedNodesRef.current.set(nodeId, measurements);
      setUnsupportedNodeVersion((version) => version + 1);

      return () => {
        const registeredMeasurements = unsupportedNodesRef.current.get(nodeId);
        if (!registeredMeasurements?.delete(measure)) {
          return;
        }
        if (registeredMeasurements.size === 0) {
          unsupportedNodesRef.current.delete(nodeId);
        }
        setUnsupportedNodeVersion((version) => version + 1);
      };
    },
    [],
  );

  const contextValue = React.useMemo(
    () => ({
      recordNode: (nodeId: string) => {
        if (generationRef.current === 0) {
          if (!pendingNodeIdsRef.current.includes(nodeId)) {
            pendingNodeIdsRef.current.push(nodeId);
          }
          return;
        }
        coordinator.recordNode(nodeId, generationRef.current);
      },
      registerUnsupportedNode,
    }),
    [coordinator, registerUnsupportedNode],
  );

  const refreshIndicatorRects = React.useCallback(async () => {
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
        const rects = await Promise.all([...nodeMeasurements].map((measure) => measure()));
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

    setIndicatorRects((current) =>
      areIndicatorRectsEqual(current, nextRects) ? current : nextRects,
    );
  }, []);

  React.useEffect(() => {
    let active = true;
    let frameId: number | null = null;

    const measureNextFrame = () => {
      void refreshIndicatorRects().finally(() => {
        if (active) {
          frameId = requestAnimationFrame(measureNextFrame);
        }
      });
    };

    measureNextFrame();

    return () => {
      active = false;
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [props.isEditMode, unsupportedNodeVersion, refreshIndicatorRects]);

  const tapGesture = React.useMemo(() => {
    return Gesture.Tap()
      .maxDeltaX(5)
      .maxDeltaY(5)
      .maxDuration(500)
      .runOnJS(true)
      .onBegin(() => {
        generationRef.current = coordinator.beginTransaction();
        for (const nodeId of pendingNodeIdsRef.current) {
          coordinator.recordNode(nodeId, generationRef.current);
        }
        pendingNodeIdsRef.current = [];
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
        pendingNodeIdsRef.current = [];
      });
  }, [coordinator]);

  React.useEffect(() => {
    coordinator.clearTransaction();
    generationRef.current = 0;
    pendingNodeIdsRef.current = [];
  }, [props.isEditMode, coordinator]);

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
          ref: rootViewRef,
          nativeID: selectionStateId,
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
