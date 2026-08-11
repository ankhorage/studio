export interface MeasuredRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface RuntimeNodeIndicatorRect extends MeasuredRect {
  readonly nodeId: string;
  readonly showUnsupportedIndicator: boolean;
}

type RuntimeNodeMeasurementSource = 'authored-root' | 'runtime-recorder';

export interface RuntimeNodeMeasurement<TResizeTarget = Element> {
  readonly getResizeTargets?: () => readonly TResizeTarget[];
  readonly measure: () => Promise<MeasuredRect | null>;
  readonly showUnsupportedIndicator: boolean;
  readonly source: RuntimeNodeMeasurementSource;
}

export type RuntimeNodeMeasurements<TResizeTarget = Element> = ReadonlyMap<
  string,
  ReadonlySet<RuntimeNodeMeasurement<TResizeTarget>>
>;

export interface ResizeTargetObserver<TResizeTarget> {
  readonly disconnect: () => void;
  readonly observe: (target: TResizeTarget) => void;
  readonly unobserve: (target: TResizeTarget) => void;
}

export interface ActiveResizeTargetCoordinator<TResizeTarget> {
  readonly disconnect: () => void;
  readonly getObservedTargets: () => ReadonlySet<TResizeTarget>;
  readonly sync: (
    measurements: readonly RuntimeNodeMeasurement<TResizeTarget>[],
    additionalTargets?: readonly TResizeTarget[],
  ) => void;
}

export interface RuntimeNodeMeasurementRegistry<TResizeTarget = Element> {
  readonly getMeasurements: () => RuntimeNodeMeasurements<TResizeTarget>;
  readonly register: (
    nodeId: string,
    measurement: RuntimeNodeMeasurement<TResizeTarget>,
  ) => () => void;
}

export function runtimeNodeMeasurementChangeAffectsActiveIndicators<TResizeTarget>(options: {
  readonly isEditMode: boolean;
  readonly activeDragNodeId?: string | null;
  readonly measurements: ReadonlySet<RuntimeNodeMeasurement<TResizeTarget>>;
  readonly nodeId: string;
  readonly selectedNodeId: string | null;
}): boolean {
  return (
    options.isEditMode &&
    ((options.activeDragNodeId !== null && options.activeDragNodeId !== undefined) ||
      options.nodeId === options.selectedNodeId ||
      [...options.measurements].some((measurement) => measurement.showUnsupportedIndicator))
  );
}

export function shouldRenderSelectedNodeChrome(
  platform: string,
  isEditMode: boolean,
  selectedNodeId: string | null,
): boolean {
  return platform === 'web' && isEditMode && selectedNodeId !== null;
}

export interface NativeMeasurableView {
  readonly measureInWindow: (
    callback: (x: number, y: number, width: number, height: number) => void,
  ) => void;
}

export function unionMeasuredRects(rects: readonly MeasuredRect[]): MeasuredRect | null {
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

export function measureNativeRuntimeNodeView(
  view: NativeMeasurableView,
): Promise<MeasuredRect | null> {
  return new Promise((resolve) => {
    view.measureInWindow((x, y, width, height) => {
      resolve(width > 0 && height > 0 ? { x, y, width, height } : null);
    });
  });
}

export function createNativeRuntimeNodeMeasurement(
  view: NativeMeasurableView,
  showUnsupportedIndicator: boolean,
): RuntimeNodeMeasurement<never> {
  return {
    measure: () => measureNativeRuntimeNodeView(view),
    showUnsupportedIndicator,
    source: 'authored-root',
  };
}

export function createRuntimeNodeMeasurementRegistry<TResizeTarget = Element>(options?: {
  readonly onChange?: () => void;
}): RuntimeNodeMeasurementRegistry<TResizeTarget> {
  const measurements = new Map<string, Set<RuntimeNodeMeasurement<TResizeTarget>>>();

  return {
    getMeasurements: () => measurements,
    register(nodeId, measurement) {
      const nodeMeasurements = measurements.get(nodeId) ?? new Set();
      nodeMeasurements.add(measurement);
      measurements.set(nodeId, nodeMeasurements);
      options?.onChange?.();

      let registered = true;
      return () => {
        if (!registered) {
          return;
        }
        registered = false;

        const registeredMeasurements = measurements.get(nodeId);
        if (!registeredMeasurements?.delete(measurement)) {
          return;
        }
        if (registeredMeasurements.size === 0) {
          measurements.delete(nodeId);
        }
        options?.onChange?.();
      };
    },
  };
}

function selectPreferredRuntimeNodeMeasurements<TResizeTarget>(
  measurements: ReadonlySet<RuntimeNodeMeasurement<TResizeTarget>>,
): readonly RuntimeNodeMeasurement<TResizeTarget>[] {
  const authoredRoots = [...measurements].filter(
    (measurement) => measurement.source === 'authored-root',
  );
  return authoredRoots.length > 0 ? authoredRoots : [...measurements];
}

export function getActiveRuntimeNodeMeasurements<TResizeTarget>(
  runtimeNodes: RuntimeNodeMeasurements<TResizeTarget>,
  isEditMode: boolean,
  selectedNodeId: string | null,
  activeDragNodeId: string | null = null,
): readonly RuntimeNodeMeasurement<TResizeTarget>[] {
  if (!isEditMode) {
    return [];
  }

  return [...runtimeNodes.entries()].flatMap(([nodeId, measurements]) => {
    const needsGeometry =
      activeDragNodeId !== null ||
      nodeId === selectedNodeId ||
      [...measurements].some((measurement) => measurement.showUnsupportedIndicator);
    return needsGeometry ? selectPreferredRuntimeNodeMeasurements(measurements) : [];
  });
}

export function hasActiveRuntimeNodeMeasurements<TResizeTarget>(
  runtimeNodes: RuntimeNodeMeasurements<TResizeTarget>,
  isEditMode: boolean,
  selectedNodeId: string | null,
  activeDragNodeId: string | null = null,
): boolean {
  return (
    getActiveRuntimeNodeMeasurements(runtimeNodes, isEditMode, selectedNodeId, activeDragNodeId)
      .length > 0
  );
}

export async function measureRuntimeNodeIndicators<TResizeTarget>(options: {
  readonly isEditMode: boolean;
  readonly activeDragNodeId?: string | null;
  readonly canvasRootNodeId?: string | null;
  readonly rootRect: MeasuredRect | null;
  readonly runtimeNodes: RuntimeNodeMeasurements<TResizeTarget>;
  readonly selectedNodeId: string | null;
}): Promise<readonly RuntimeNodeIndicatorRect[]> {
  const {
    activeDragNodeId = null,
    canvasRootNodeId = null,
    isEditMode,
    rootRect,
    runtimeNodes,
    selectedNodeId,
  } = options;
  if (!isEditMode || !rootRect) {
    return [];
  }

  const activeNodes = [...runtimeNodes.entries()].filter(
    ([nodeId, measurements]) =>
      activeDragNodeId !== null ||
      nodeId === selectedNodeId ||
      [...measurements].some((measurement) => measurement.showUnsupportedIndicator),
  );
  const measured = await Promise.all(
    activeNodes.map(async ([nodeId, measurements]) => {
      const preferredMeasurements = selectPreferredRuntimeNodeMeasurements(measurements);
      const rects = await Promise.all(
        preferredMeasurements.map((measurement) => measurement.measure()),
      );
      return {
        nodeId,
        rect: unionMeasuredRects(rects.filter((rect): rect is MeasuredRect => rect !== null)),
        showUnsupportedIndicator: [...measurements].some(
          (measurement) => measurement.showUnsupportedIndicator,
        ),
      };
    }),
  );

  const indicators = measured.flatMap(({ nodeId, rect, showUnsupportedIndicator }) =>
    rect
      ? [
          {
            nodeId,
            showUnsupportedIndicator,
            x: rect.x - rootRect.x,
            y: rect.y - rootRect.y,
            width: rect.width,
            height: rect.height,
          },
        ]
      : [],
  );

  if (
    activeDragNodeId !== null &&
    canvasRootNodeId !== null &&
    !indicators.some((rect) => rect.nodeId === canvasRootNodeId)
  ) {
    indicators.push({
      nodeId: canvasRootNodeId,
      showUnsupportedIndicator: false,
      x: 0,
      y: 0,
      width: rootRect.width,
      height: rootRect.height,
    });
  }

  return indicators.sort((left, right) => left.nodeId.localeCompare(right.nodeId));
}

export function createActiveResizeTargetCoordinator<TResizeTarget>(
  observer: ResizeTargetObserver<TResizeTarget>,
): ActiveResizeTargetCoordinator<TResizeTarget> {
  let observedTargets = new Set<TResizeTarget>();
  let disconnected = false;

  return {
    disconnect() {
      if (disconnected) {
        return;
      }
      disconnected = true;
      observer.disconnect();
      observedTargets = new Set();
    },
    getObservedTargets: () => observedTargets,
    sync(measurements, additionalTargets = []) {
      if (disconnected) {
        return;
      }

      const desiredTargets = new Set<TResizeTarget>(additionalTargets);
      for (const measurement of measurements) {
        for (const target of measurement.getResizeTargets?.() ?? []) {
          desiredTargets.add(target);
        }
      }

      for (const target of observedTargets) {
        if (!desiredTargets.has(target)) {
          observer.unobserve(target);
        }
      }
      for (const target of desiredTargets) {
        if (!observedTargets.has(target)) {
          observer.observe(target);
        }
      }
      observedTargets = desiredTargets;
    },
  };
}

export function createSelectedIndicatorViewProps(
  rect: RuntimeNodeIndicatorRect,
  borderColor: string,
): {
  readonly pointerEvents: 'none';
  readonly style: {
    readonly position: 'absolute';
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
    readonly borderWidth: 2;
    readonly borderColor: string;
    readonly borderRadius: 4;
  };
} {
  return {
    pointerEvents: 'none',
    style: {
      position: 'absolute',
      left: rect.x - 2,
      top: rect.y - 2,
      width: rect.width + 4,
      height: rect.height + 4,
      borderWidth: 2,
      borderColor,
      borderRadius: 4,
    },
  };
}
