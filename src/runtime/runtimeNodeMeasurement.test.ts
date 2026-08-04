import { describe, expect, it } from 'bun:test';

import {
  createActiveResizeTargetCoordinator,
  createNativeRuntimeNodeMeasurement,
  createRuntimeNodeMeasurementRegistry,
  createSelectedIndicatorViewProps,
  getActiveRuntimeNodeMeasurements,
  measureNativeRuntimeNodeView,
  measureRuntimeNodeIndicators,
  type ResizeTargetObserver,
  type RuntimeNodeMeasurement,
  runtimeNodeMeasurementChangeAffectsActiveIndicators,
  shouldRenderSelectedNodeChrome,
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

describe('native unsupported Runtime node measurement lifecycle', () => {
  it('measures an authored unsupported root and follows moved geometry', async () => {
    const registry = createRuntimeNodeMeasurementRegistry<never>();
    let rect = { x: 42, y: 86, width: 180, height: 44 };
    const view = {
      measureInWindow(callback: (x: number, y: number, width: number, height: number) => void) {
        callback(rect.x, rect.y, rect.width, rect.height);
      },
    };

    const unregister = registry.register(
      'unsupported-extension-root',
      createNativeRuntimeNodeMeasurement(view, true),
    );

    const rootRect = { x: 10, y: 20, width: 320, height: 640 };
    const indicators = await measureRuntimeNodeIndicators({
      isEditMode: true,
      rootRect,
      runtimeNodes: registry.getMeasurements(),
      selectedNodeId: null,
    });
    expect(indicators).toEqual([
      {
        nodeId: 'unsupported-extension-root',
        showUnsupportedIndicator: true,
        x: 32,
        y: 66,
        width: 180,
        height: 44,
      },
    ]);

    rect = { x: 42, y: 26, width: 240, height: 52 };
    const movedIndicators = await measureRuntimeNodeIndicators({
      isEditMode: true,
      rootRect,
      runtimeNodes: registry.getMeasurements(),
      selectedNodeId: null,
    });
    expect(movedIndicators[0]).toMatchObject({ x: 32, y: 6, width: 240, height: 52 });

    expect(
      await measureRuntimeNodeIndicators({
        isEditMode: false,
        rootRect,
        runtimeNodes: registry.getMeasurements(),
        selectedNodeId: null,
      }),
    ).toEqual([]);

    unregister();
    expect(registry.getMeasurements().has('unsupported-extension-root')).toBe(false);
  });

  it('accepts positive measureInWindow geometry and rejects zero-sized roots', async () => {
    expect(
      await measureNativeRuntimeNodeView({
        measureInWindow: (callback) => callback(20, 30, 40, 50),
      }),
    ).toEqual({ x: 20, y: 30, width: 40, height: 50 });
    expect(
      await measureNativeRuntimeNodeView({
        measureInWindow: (callback) => callback(20, 30, 0, 50),
      }),
    ).toBeNull();
  });
});

describe('active web Runtime node resize targets', () => {
  it('renders exact non-intercepting selected chrome only on web in Edit mode', () => {
    expect(shouldRenderSelectedNodeChrome('web', true, 'selected')).toBe(true);
    expect(shouldRenderSelectedNodeChrome('web', false, 'selected')).toBe(false);
    expect(shouldRenderSelectedNodeChrome('web', true, null)).toBe(false);
    expect(shouldRenderSelectedNodeChrome('ios', true, 'selected')).toBe(false);
    expect(shouldRenderSelectedNodeChrome('android', true, 'selected')).toBe(false);

    expect(
      createSelectedIndicatorViewProps(
        {
          nodeId: 'selected',
          showUnsupportedIndicator: false,
          x: 32,
          y: 66,
          width: 180,
          height: 44,
        },
        '#123456',
      ),
    ).toEqual({
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
  });

  it('synchronizes registration only when the changed local node is active', () => {
    const inactive = createTargetMeasurement({ targets: [] });
    const unsupported = createTargetMeasurement({ targets: [], unsupported: true });
    let synchronizationCount = 0;

    for (let index = 0; index < 200; index += 1) {
      const nodeId = `node-${index}`;
      if (
        runtimeNodeMeasurementChangeAffectsActiveIndicators({
          isEditMode: true,
          measurements: new Set([inactive]),
          nodeId,
          selectedNodeId: 'selected',
        })
      ) {
        synchronizationCount += 1;
      }
    }
    expect(synchronizationCount).toBe(0);

    const selectedMeasurements = new Set([inactive, createTargetMeasurement({ targets: [] })]);
    expect(
      runtimeNodeMeasurementChangeAffectsActiveIndicators({
        isEditMode: true,
        measurements: selectedMeasurements,
        nodeId: 'selected',
        selectedNodeId: 'selected',
      }),
    ).toBe(true);
    selectedMeasurements.delete(inactive);
    expect(
      runtimeNodeMeasurementChangeAffectsActiveIndicators({
        isEditMode: true,
        measurements: selectedMeasurements,
        nodeId: 'selected',
        selectedNodeId: 'selected',
      }),
    ).toBe(true);

    const unsupportedMeasurements = new Set([inactive, unsupported]);
    expect(
      runtimeNodeMeasurementChangeAffectsActiveIndicators({
        isEditMode: true,
        measurements: unsupportedMeasurements,
        nodeId: 'unsupported',
        selectedNodeId: null,
      }),
    ).toBe(true);
    unsupportedMeasurements.delete(unsupported);
    expect(
      runtimeNodeMeasurementChangeAffectsActiveIndicators({
        isEditMode: true,
        measurements: unsupportedMeasurements,
        nodeId: 'unsupported',
        selectedNodeId: null,
      }),
    ).toBe(false);
    expect(
      runtimeNodeMeasurementChangeAffectsActiveIndicators({
        isEditMode: false,
        measurements: new Set([unsupported]),
        nodeId: 'unsupported',
        selectedNodeId: 'unsupported',
      }),
    ).toBe(false);
  });

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
