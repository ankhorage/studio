import { describe, expect, it } from 'bun:test';

import {
  createStationarySelectionInputState,
  type StationaryPointerInput,
  type StationaryTouchInput,
} from './stationarySelectionInputState';

function pointer(overrides: Partial<StationaryPointerInput> = {}): StationaryPointerInput {
  return {
    kind: 'pointer',
    button: 0,
    interactionId: 1,
    isPrimary: true,
    pointerId: 1,
    pointerType: 'mouse',
    ...overrides,
  };
}

function touch(overrides: Partial<StationaryTouchInput> = {}): StationaryTouchInput {
  return {
    kind: 'touch',
    interactionId: 1,
    touchId: '1',
    ...overrides,
  };
}

function createHarness() {
  let active = false;
  const activePath: string[] = [];
  const state = createStationarySelectionInputState({
    hasActiveTransaction: () => active,
    recordActiveNode: (nodeId) => {
      if (!activePath.includes(nodeId)) {
        activePath.push(nodeId);
      }
    },
  });

  return {
    activePath,
    state,
    setActive: (nextActive: boolean) => {
      active = nextActive;
    },
  };
}

describe('stationary selection input state', () => {
  it('right-click followed by left-click imports only the later path', () => {
    const harness = createHarness();

    expect(harness.state.recordNode('node-a', pointer({ button: 2 }))).toBe(false);
    harness.state.completePendingInteraction();
    harness.state.recordNode('node-b', pointer({ interactionId: 2 }));
    harness.setActive(true);
    harness.state.beginTransaction((nodeId) => harness.activePath.push(nodeId));

    expect(harness.activePath).toEqual(['node-b']);
  });

  it('middle-click followed by left-click imports only the later path', () => {
    const harness = createHarness();

    expect(harness.state.recordNode('node-a', pointer({ button: 1 }))).toBe(false);
    harness.state.completePendingInteraction();
    harness.state.recordNode('node-b', pointer({ interactionId: 2 }));
    harness.setActive(true);
    harness.state.beginTransaction((nodeId) => harness.activePath.push(nodeId));

    expect(harness.activePath).toEqual(['node-b']);
  });

  it('clears a cancelled pending pointer path', () => {
    const harness = createHarness();

    harness.state.recordNode('node-a', pointer());
    harness.state.completePendingInteraction();

    expect(harness.state.getPendingPath()).toEqual([]);
  });

  it('ignores secondary pointers', () => {
    const harness = createHarness();

    expect(harness.state.recordNode('node-a', pointer({ isPrimary: false }))).toBe(false);
    expect(harness.state.getPendingPath()).toEqual([]);
  });

  it('preserves deepest-first ordering for ordinary left-click', () => {
    const harness = createHarness();

    harness.state.recordNode('deepest', pointer());
    harness.state.recordNode('parent', pointer());
    harness.setActive(true);
    harness.state.beginTransaction((nodeId) => harness.activePath.push(nodeId));

    expect(harness.activePath).toEqual(['deepest', 'parent']);
  });

  it('records touch input', () => {
    const harness = createHarness();

    harness.state.recordNode('deepest', touch());
    harness.state.recordNode('parent', touch());
    harness.setActive(true);
    harness.state.beginTransaction((nodeId) => harness.activePath.push(nodeId));

    expect(harness.activePath).toEqual(['deepest', 'parent']);
  });

  it('deduplicates pointer and touch records once the transaction is active', () => {
    const harness = createHarness();
    harness.setActive(true);

    harness.state.recordNode('node-a', pointer({ pointerType: 'touch' }));
    harness.state.recordNode('node-a', touch());

    expect(harness.activePath).toEqual(['node-a']);
  });

  it('replaces an abandoned pending path when a new physical interaction starts', () => {
    const harness = createHarness();

    harness.state.recordNode('node-a', pointer());
    harness.state.recordNode('node-b', pointer({ interactionId: 2 }));
    harness.setActive(true);
    harness.state.beginTransaction((nodeId) => harness.activePath.push(nodeId));

    expect(harness.activePath).toEqual(['node-b']);
  });
});
