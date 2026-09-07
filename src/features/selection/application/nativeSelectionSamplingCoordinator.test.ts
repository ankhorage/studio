import { describe, expect, it } from 'bun:test';

import { createNativeSelectionSamplingCoordinator } from './nativeSelectionSamplingCoordinator';

function createFrameProbe() {
  let nextId = 1;
  const callbacks = new Map<number, () => void>();
  return {
    scheduler: {
      cancel: (frameId: number) => {
        callbacks.delete(frameId);
      },
      request: (callback: () => void) => {
        const frameId = nextId;
        nextId += 1;
        callbacks.set(frameId, callback);
        return frameId;
      },
    },
    flushOne: () => {
      const entry = callbacks.entries().next().value;
      if (!entry) return false;
      callbacks.delete(entry[0]);
      entry[1]();
      return true;
    },
    pendingCount: () => callbacks.size,
  };
}

describe('native selection sampling coordinator', () => {
  it('samples at most once per frame without overlapping async work', async () => {
    const frames = createFrameProbe();
    let resolveSample!: () => void;
    let samples = 0;
    const coordinator = createNativeSelectionSamplingCoordinator({
      sample: () => {
        samples += 1;
        return new Promise<void>((resolve) => {
          resolveSample = resolve;
        });
      },
      scheduler: frames.scheduler,
      shouldContinue: () => true,
    });

    expect(coordinator.start()).toBe(true);
    expect(coordinator.start()).toBe(false);
    expect(frames.pendingCount()).toBe(1);
    frames.flushOne();
    expect(samples).toBe(1);
    expect(frames.pendingCount()).toBe(0);

    resolveSample();
    await Promise.resolve();
    expect(frames.pendingCount()).toBe(1);
    coordinator.stop();
    expect(frames.pendingCount()).toBe(0);
  });

  it('stops after eligibility changes and can restart later', async () => {
    const frames = createFrameProbe();
    let eligible = true;
    let samples = 0;
    const coordinator = createNativeSelectionSamplingCoordinator({
      sample: () => {
        samples += 1;
        return Promise.resolve();
      },
      scheduler: frames.scheduler,
      shouldContinue: () => eligible,
    });

    coordinator.start();
    frames.flushOne();
    await Promise.resolve();
    eligible = false;
    frames.flushOne();
    expect(coordinator.isRunning()).toBe(false);
    expect(samples).toBe(1);

    eligible = true;
    expect(coordinator.start()).toBe(true);
    expect(frames.pendingCount()).toBe(1);
  });

  it('does not restart after stopping during an in-flight sample', async () => {
    const frames = createFrameProbe();
    let resolveSample!: () => void;
    const coordinator = createNativeSelectionSamplingCoordinator({
      sample: () =>
        new Promise<void>((resolve) => {
          resolveSample = resolve;
        }),
      scheduler: frames.scheduler,
      shouldContinue: () => true,
    });

    coordinator.start();
    frames.flushOne();
    coordinator.stop();
    resolveSample();
    await Promise.resolve();
    expect(frames.pendingCount()).toBe(0);
    expect(coordinator.isRunning()).toBe(false);
  });
});
