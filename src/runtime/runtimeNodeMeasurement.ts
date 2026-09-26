import { unionRects } from '@ankhorage/utility/geometry';
import { createObservedSetCoordinator } from '@ankhorage/utility/observer';
import { createKeyedMultiValueRegistry } from '@ankhorage/utility/registry';

import {
  intersectNativeElementRects,
  measureNativeElement,
  type NativeElementLike,
} from '../features/selection/adapters/nativeElementMeasurement.js';
import type { MeasuredRect, RuntimeNodeIndicatorRect } from '../types/runtime-node-measurement.js';

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

/*** Decide whether one runtime-node measurement change can affect currently visible Studio indicators. */
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

/*** Decide whether Studio should render selected-node chrome for the active platform/edit state. */
export function shouldRenderSelectedNodeChrome(
  platform: string,
  isEditMode: boolean,
  selectedNodeId: string | null,
): boolean {
  return ['android', 'ios', 'web'].includes(platform) && isEditMode && selectedNodeId !== null;
}

/*** Compute the smallest rectangle containing every measured rectangle. */
function unionMeasuredRects(rects: readonly MeasuredRect[]): MeasuredRect | null {
  return unionRects(rects);
}

/*** Adapt a native measurable view into Studio's runtime-node measurement contract. */
export function createNativeRuntimeNodeMeasurement(
  view: NativeElementLike,
  showUnsupportedIndicator: boolean,
): RuntimeNodeMeasurement<never> {
  return {
    /*** Measure the adapted native view in window coordinates. */
    measure: () => Promise.resolve(measureNativeElement(view)),
    showUnsupportedIndicator,
    source: 'authored-root',
  };
}

/*** Adapt the shared keyed registry to Studio runtime-node measurements. */
export function createRuntimeNodeMeasurementRegistry<TResizeTarget = Element>(options?: {
  readonly onChange?: () => void;
}): RuntimeNodeMeasurementRegistry<TResizeTarget> {
  const registry = createKeyedMultiValueRegistry<string, RuntimeNodeMeasurement<TResizeTarget>>(
    options,
  );
  return { getMeasurements: registry.getValues, register: registry.register };
}

/*** Prefer authored-root measurements when present, otherwise keep every runtime measurement for the node. */
function selectPreferredRuntimeNodeMeasurements<TResizeTarget>(
  measurements: ReadonlySet<RuntimeNodeMeasurement<TResizeTarget>>,
): readonly RuntimeNodeMeasurement<TResizeTarget>[] {
  const authoredRoots = [...measurements].filter(
    (measurement) => measurement.source === 'authored-root',
  );
  return authoredRoots.length > 0 ? authoredRoots : [...measurements];
}

/*** Select runtime-node measurements whose geometry is currently relevant to Studio edit indicators. */
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

/*** Return whether Studio currently has at least one active runtime-node measurement. */
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

/*** Measure active runtime nodes and project their window geometry into canvas-relative indicator rectangles. */
export async function measureRuntimeNodeIndicators<TResizeTarget>(options: {
  readonly isEditMode: boolean;
  readonly activeDragNodeId?: string | null;
  readonly canvasRootNodeId?: string | null;
  readonly clipToRoot?: boolean;
  readonly rootRect: MeasuredRect | null;
  readonly runtimeNodes: RuntimeNodeMeasurements<TResizeTarget>;
  readonly selectedNodeId: string | null;
}): Promise<readonly RuntimeNodeIndicatorRect[]> {
  const {
    activeDragNodeId = null,
    canvasRootNodeId = null,
    clipToRoot = false,
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
      const unionRect = unionMeasuredRects(
        rects.filter((rect): rect is MeasuredRect => rect !== null),
      );
      return {
        nodeId,
        rect:
          unionRect && clipToRoot ? intersectNativeElementRects(unionRect, rootRect) : unionRect,
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

/*** Adapt the shared observed-set coordinator to active Studio measurement targets. */
export function createActiveResizeTargetCoordinator<TResizeTarget>(
  observer: ResizeTargetObserver<TResizeTarget>,
): ActiveResizeTargetCoordinator<TResizeTarget> {
  const coordinator = createObservedSetCoordinator(observer);
  return {
    disconnect: coordinator.disconnect,
    getObservedTargets: coordinator.getObservedValues,
    sync(measurements, additionalTargets = []) {
      const targets = new Set<TResizeTarget>(additionalTargets);
      for (const measurement of measurements) {
        for (const target of measurement.getResizeTargets?.() ?? []) targets.add(target);
      }
      coordinator.sync(targets);
    },
  };
}

/*** Create the React-Native-style absolute overlay props used to render Studio selected-node chrome around a measured rectangle. */
export function createSelectedIndicatorViewProps(
  rect: RuntimeNodeIndicatorRect,
  borderColor: string,
): {
  readonly accessible: false;
  readonly accessibilityElementsHidden: true;
  readonly importantForAccessibility: 'no-hide-descendants';
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
    accessible: false,
    accessibilityElementsHidden: true,
    importantForAccessibility: 'no-hide-descendants',
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
