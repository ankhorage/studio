import { describe, expect, it } from 'bun:test';

import {
  createActiveResizeTargetCoordinator,
  createNativeRuntimeNodeMeasurement,
  createRuntimeNodeMeasurementRegistry,
  createSelectedIndicatorViewProps,
  getActiveRuntimeNodeMeasurements,
  measureRuntimeNodeIndicators,
  type ResizeTargetObserver,
  type RuntimeNodeMeasurement,
} from './runtimeNodeMeasurement';

interface TestTarget {
  readonly id: string;
}

function createObserverProbe(): ResizeTargetObserver<TestTarget> & {
  readonly disconnected: () => number;
  readonly observed: () => readonly TestTarget[];
  readonly observeCalls: () => number;
  readonly unobserveCalls: () => number;
} {
  const liveTargets = new Set<TestTarget>();
  let disconnectCount = 0;
  let observeCount = 0;
  let unobserveCount = 0;

  return {
    disconnect() {
      disconnectCount += 1;
      liveTargets.clear();
    },
    disconnected: () => disconnectCount,
    observe(target) {
      observeCount += 1;
      liveTargets.add(target);
    },
    observed: () => [...liveTargets],
    observeCalls: () => observeCount,
    unobserve(target) {
      unobserveCount += 1;
      liveTargets.delete(target);
    },
    unobserveCalls: () => unobserveCount,
  };
}

function createTargetMeasurement(options: {
  readonly targets: readonly TestTarget[];
  readonly unsupported?: boolean;
  readonly onResolveTargets?: () => void;
}): RuntimeNodeMeasurement<TestTarget> {
  return {
    getResizeTargets: () => {
      options.onResolveTargets?.();
      return options.targets;
    },
    measure: () => Promise.resolve({ x: 0, y: 0, width: 20, height: 20 }),
    showUnsupportedIndicator: options.unsupported === true,
    source: 'web-recorder',
  };
}

describe('native Runtime node measurement lifecycle', () => {
  it('measures supported leaf, container, root, and moved scroll geometry for selected chrome', async () => {
    const registry = createRuntimeNodeMeasurementRegistry<never>();
    const rects = {
      leaf: { x: 42, y: 86, width: 180, height: 44 },
      container: { x: 30, y: 70, width: 260, height: 180 },
      root: { x: 10, y: 20, width: 320, height: 640 },
    };
    const view = (key: keyof typeof rects) => ({
      measureInWindow(callback: (x: number, y: number, width: number, height: number) => void) {
        const rect = rects[key];
        callback(rect.x, rect.y, rect.width, rect.height);
      },
    });

    const unregisterLeaf = registry.register(
      'supported-runtime-leaf',
      createNativeRuntimeNodeMeasurement(view('leaf'), false),
    );
    registry.register(
      'supported-runtime-container',
      createNativeRuntimeNodeMeasurement(view('container'), false),
    );
    registry.register(
      'supported-screen-root',
      createNativeRuntimeNodeMeasurement(view('root'), false),
    );

    const rootRect = { x: 10, y: 20, width: 320, height: 640 };
    const leafIndicators = await measureRuntimeNodeIndicators({
      isEditMode: true,
      rootRect,
      runtimeNodes: registry.getMeasurements(),
      selectedNodeId: 'supported-runtime-leaf',
    });
    expect(leafIndicators).toEqual([
      {
        nodeId: 'supported-runtime-leaf',
        showUnsupportedIndicator: false,
        x: 32,
        y: 66,
        width: 180,
        height: 44,
      },
    ]);
    expect(leafIndicators[0]?.width).toBeGreaterThan(0);
    expect(leafIndicators[0]?.height).toBeGreaterThan(0);
    const [leafIndicator] = leafIndicators;
    if (!leafIndicator) {
      throw new Error('Expected supported leaf indicator geometry.');
    }
    expect(createSelectedIndicatorViewProps(leafIndicator, '#123456')).toEqual({
      pointerEvents: 'none',
      style: {
        position: 'absolute',
        left: 30,
        top: 64,
        width: 184,
        height: 48,
        borderWidth: 2,
        borderColor: '#123456',
        borderRadius: 4,
      },
    });

    const containerIndicators = await measureRuntimeNodeIndicators({
      isEditMode: true,
      rootRect,
      runtimeNodes: registry.getMeasurements(),
      selectedNodeId: 'supported-runtime-container',
    });
    expect(containerIndicators[0]).toMatchObject({ x: 20, y: 50, width: 260, height: 180 });

    const rootIndicators = await measureRuntimeNodeIndicators({
      isEditMode: true,
      rootRect,
      runtimeNodes: registry.getMeasurements(),
      selectedNodeId: 'supported-screen-root',
    });
    expect(rootIndicators[0]).toMatchObject({ x: 0, y: 0, width: 320, height: 640 });

    rects.leaf = { x: 42, y: 26, width: 240, height: 52 };
    const movedIndicators = await measureRuntimeNodeIndicators({
      isEditMode: true,
      rootRect,
      runtimeNodes: registry.getMeasurements(),
      selectedNodeId: 'supported-runtime-leaf',
    });
    expect(movedIndicators[0]).toMatchObject({ x: 32, y: 6, width: 240, height: 52 });

    expect(
      await measureRuntimeNodeIndicators({
        isEditMode: true,
        rootRect,
        runtimeNodes: registry.getMeasurements(),
        selectedNodeId: null,
      }),
    ).toEqual([]);
    expect(
      await measureRuntimeNodeIndicators({
        isEditMode: false,
        rootRect,
        runtimeNodes: registry.getMeasurements(),
        selectedNodeId: 'supported-runtime-leaf',
      }),
    ).toEqual([]);

    unregisterLeaf();
    expect(registry.getMeasurements().has('supported-runtime-leaf')).toBe(false);
  });

  it('prefers an authored root over recorder fallback geometry', async () => {
    const registry = createRuntimeNodeMeasurementRegistry<never>();
    registry.register('node', {
      measure: () => Promise.resolve({ x: 0, y: 0, width: 999, height: 999 }),
      showUnsupportedIndicator: false,
      source: 'web-recorder',
    });
    registry.register(
      'node',
      createNativeRuntimeNodeMeasurement(
        {
          measureInWindow: (callback) => callback(20, 30, 40, 50),
        },
        false,
      ),
    );

    const indicators = await measureRuntimeNodeIndicators({
      isEditMode: true,
      rootRect: { x: 10, y: 10, width: 300, height: 300 },
      runtimeNodes: registry.getMeasurements(),
      selectedNodeId: 'node',
    });
    expect(indicators[0]).toMatchObject({ x: 10, y: 20, width: 40, height: 50 });
  });
});

describe('active web Runtime node resize targets', () => {
  it('keeps deep-tree registration linear and traverses descendants only for the active node', () => {
    const nodeCount = 200;
    const targets = Array.from({ length: nodeCount }, (_, index) => ({ id: `target-${index}` }));
    const registry = createRuntimeNodeMeasurementRegistry<TestTarget>();
    const resolvedByNode = new Map<string, number>();

    for (let index = 0; index < nodeCount; index += 1) {
      const nodeId = `node-${index}`;
      registry.register(
        nodeId,
        createTargetMeasurement({
          targets: targets.slice(index),
          onResolveTargets: () => resolvedByNode.set(nodeId, (resolvedByNode.get(nodeId) ?? 0) + 1),
        }),
      );
    }

    expect(registry.getMeasurements().size).toBe(nodeCount);
    expect(resolvedByNode.size).toBe(0);

    const observer = createObserverProbe();
    const coordinator = createActiveResizeTargetCoordinator(observer);
    coordinator.sync(
      getActiveRuntimeNodeMeasurements(registry.getMeasurements(), true, 'node-199'),
    );

    expect([...resolvedByNode.entries()]).toEqual([['node-199', 1]]);
    expect(observer.observeCalls()).toBe(1);
    expect(observer.unobserveCalls()).toBe(0);
    const selectedTarget = targets.at(-1);
    if (!selectedTarget) {
      throw new Error('Expected the deepest target fixture.');
    }
    expect(observer.observed()).toEqual([selectedTarget]);
  });

  it('diffs selection targets and observes overlapping ownership exactly once', () => {
    const shared = { id: 'shared' };
    const firstOnly = { id: 'first-only' };
    const secondOnly = { id: 'second-only' };
    const first = createTargetMeasurement({ targets: [firstOnly, shared] });
    const second = createTargetMeasurement({ targets: [shared, secondOnly] });
    const observer = createObserverProbe();
    const coordinator = createActiveResizeTargetCoordinator(observer);

    coordinator.sync([first, second]);
    expect(observer.observeCalls()).toBe(3);
    expect(new Set(observer.observed())).toEqual(new Set([firstOnly, shared, secondOnly]));

    coordinator.sync([second]);
    expect(observer.unobserveCalls()).toBe(1);
    expect(observer.observed()).toEqual([shared, secondOnly]);

    coordinator.sync([]);
    expect(observer.unobserveCalls()).toBe(3);
    expect(observer.observed()).toEqual([]);
  });

  it('replaces old-only selection targets while retaining the shared target', () => {
    const shared = { id: 'shared' };
    const firstOnly = { id: 'first-only' };
    const secondOnly = { id: 'second-only' };
    const registry = createRuntimeNodeMeasurementRegistry<TestTarget>();
    registry.register('first', createTargetMeasurement({ targets: [firstOnly, shared] }));
    registry.register('second', createTargetMeasurement({ targets: [shared, secondOnly] }));
    const observer = createObserverProbe();
    const coordinator = createActiveResizeTargetCoordinator(observer);

    coordinator.sync(getActiveRuntimeNodeMeasurements(registry.getMeasurements(), true, 'first'));
    expect(new Set(observer.observed())).toEqual(new Set([firstOnly, shared]));

    coordinator.sync(getActiveRuntimeNodeMeasurements(registry.getMeasurements(), true, 'second'));
    expect(new Set(observer.observed())).toEqual(new Set([shared, secondOnly]));
    expect(observer.observeCalls()).toBe(3);
    expect(observer.unobserveCalls()).toBe(1);

    for (let iteration = 0; iteration < 20; iteration += 1) {
      const selectedNodeId = iteration % 2 === 0 ? 'first' : 'second';
      coordinator.sync(
        getActiveRuntimeNodeMeasurements(registry.getMeasurements(), true, selectedNodeId),
      );
      expect(coordinator.getObservedTargets().size).toBe(2);
    }
    expect(new Set(observer.observed())).toEqual(new Set([shared, secondOnly]));
  });

  it('coexists with unsupported indicators, releases Preview targets, and does not leak', () => {
    const selectedTarget = { id: 'selected' };
    const unsupportedTarget = { id: 'unsupported' };
    const registry = createRuntimeNodeMeasurementRegistry<TestTarget>();
    registry.register('selected', createTargetMeasurement({ targets: [selectedTarget] }));
    registry.register(
      'unsupported',
      createTargetMeasurement({ targets: [unsupportedTarget], unsupported: true }),
    );
    const observer = createObserverProbe();
    const coordinator = createActiveResizeTargetCoordinator(observer);

    const editMeasurements = getActiveRuntimeNodeMeasurements(
      registry.getMeasurements(),
      true,
      'selected',
    );
    coordinator.sync(editMeasurements);
    expect(new Set(observer.observed())).toEqual(new Set([selectedTarget, unsupportedTarget]));

    for (let iteration = 0; iteration < 20; iteration += 1) {
      coordinator.sync(editMeasurements);
    }
    expect(observer.observeCalls()).toBe(2);
    expect(observer.unobserveCalls()).toBe(0);

    coordinator.sync(getActiveRuntimeNodeMeasurements(registry.getMeasurements(), false, null));
    expect(observer.observed()).toEqual([]);
    expect(observer.unobserveCalls()).toBe(2);

    coordinator.disconnect();
    expect(observer.disconnected()).toBe(1);
    expect(coordinator.getObservedTargets().size).toBe(0);
    coordinator.disconnect();
    expect(observer.disconnected()).toBe(1);
  });
});
