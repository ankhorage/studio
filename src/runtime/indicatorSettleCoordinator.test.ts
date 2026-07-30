import { describe, expect, it } from 'bun:test';

import { createIndicatorSettleCoordinator } from './indicatorSettleCoordinator';

function createFakeScheduler() {
  let nextHandle = 1;
  const callbacks = new Map<number, () => void>();

  return {
    callbacks,
    scheduler: {
      cancel: (handle: number) => {
        callbacks.delete(handle);
      },
      schedule: (callback: () => void, _delayMs: number) => {
        const handle = nextHandle++;
        callbacks.set(handle, callback);
        return handle;
      },
    },
    flushNext: async () => {
      const entry = callbacks.entries().next().value as readonly [number, () => void] | undefined;
      if (!entry) {
        return;
      }
      callbacks.delete(entry[0]);
      entry[1]();
      await Promise.resolve();
      await Promise.resolve();
    },
  };
}

describe('indicator settle coordinator', () => {
  it('keeps rapid triggers in one active settle sequence', () => {
    const scheduler = createFakeScheduler();
    const coordinator = createIndicatorSettleCoordinator({
      areEqual: Object.is,
      intervalMs: 60,
      maxSamples: 10,
      sample: () => Promise.resolve(1),
      scheduler: scheduler.scheduler,
      stableSampleCount: 3,
    });

    expect(coordinator.trigger()).toBe(true);
    expect(coordinator.trigger()).toBe(false);
    expect(coordinator.trigger()).toBe(false);
    expect(scheduler.callbacks.size).toBe(1);
    expect(coordinator.isActive()).toBe(true);
  });

  it('restarts the same sequence when new input arrives', async () => {
    const scheduler = createFakeScheduler();
    let nextSnapshot = 1;
    const coordinator = createIndicatorSettleCoordinator({
      areEqual: Object.is,
      intervalMs: 60,
      maxSamples: 10,
      sample: () => Promise.resolve(nextSnapshot),
      scheduler: scheduler.scheduler,
      stableSampleCount: 2,
    });

    coordinator.trigger();
    await scheduler.flushNext();
    expect(scheduler.callbacks.size).toBe(1);

    nextSnapshot = 2;
    expect(coordinator.trigger()).toBe(false);
    expect(scheduler.callbacks.size).toBe(1);
    await scheduler.flushNext();

    expect(coordinator.isActive()).toBe(true);
    expect(scheduler.callbacks.size).toBe(1);
  });

  it('stops after the required stable samples', async () => {
    const scheduler = createFakeScheduler();
    let sampleCount = 0;
    const coordinator = createIndicatorSettleCoordinator({
      areEqual: Object.is,
      intervalMs: 60,
      maxSamples: 10,
      sample: () => {
        sampleCount += 1;
        return Promise.resolve(4);
      },
      scheduler: scheduler.scheduler,
      stableSampleCount: 3,
    });

    coordinator.trigger();
    await scheduler.flushNext();
    await scheduler.flushNext();
    await scheduler.flushNext();

    expect(sampleCount).toBe(3);
    expect(coordinator.isActive()).toBe(false);
    expect(scheduler.callbacks.size).toBe(0);
  });

  it('stops at the maximum bound when geometry never stabilizes', async () => {
    const scheduler = createFakeScheduler();
    let snapshot = 0;
    const coordinator = createIndicatorSettleCoordinator({
      areEqual: Object.is,
      intervalMs: 60,
      maxSamples: 4,
      sample: () => Promise.resolve(++snapshot),
      scheduler: scheduler.scheduler,
      stableSampleCount: 3,
    });

    coordinator.trigger();
    await scheduler.flushNext();
    await scheduler.flushNext();
    await scheduler.flushNext();
    await scheduler.flushNext();

    expect(snapshot).toBe(4);
    expect(coordinator.isActive()).toBe(false);
    expect(scheduler.callbacks.size).toBe(0);
  });

  it('cancels all pending work for Preview or unmount cleanup', async () => {
    const scheduler = createFakeScheduler();
    let sampleCount = 0;
    const coordinator = createIndicatorSettleCoordinator({
      areEqual: Object.is,
      intervalMs: 60,
      maxSamples: 10,
      sample: () => Promise.resolve(++sampleCount),
      scheduler: scheduler.scheduler,
      stableSampleCount: 3,
    });

    coordinator.trigger();
    coordinator.cancel();
    await scheduler.flushNext();
    expect(sampleCount).toBe(0);
    expect(coordinator.isActive()).toBe(false);

    coordinator.trigger();
    coordinator.cancel();
    await scheduler.flushNext();
    expect(sampleCount).toBe(0);
    expect(scheduler.callbacks.size).toBe(0);
  });

  it('stops without rescheduling when measurement reports no unsupported nodes', async () => {
    const scheduler = createFakeScheduler();
    let sampleCount = 0;
    const coordinator = createIndicatorSettleCoordinator({
      areEqual: Object.is,
      intervalMs: 60,
      maxSamples: 10,
      sample: () => {
        sampleCount += 1;
        return Promise.resolve(null);
      },
      scheduler: scheduler.scheduler,
      stableSampleCount: 3,
    });

    coordinator.trigger();
    await scheduler.flushNext();

    expect(sampleCount).toBe(1);
    expect(coordinator.isActive()).toBe(false);
    expect(scheduler.callbacks.size).toBe(0);
  });
});
