import { describe, expect, it } from 'bun:test';

import { createIndicatorRefreshCoordinator } from './indicatorRefreshCoordinator';

function createFakeFrameScheduler() {
  let nextFrameId = 1;
  const callbacks = new Map<number, () => void>();

  return {
    callbacks,
    scheduler: {
      request: (callback: () => void) => {
        const frameId = nextFrameId++;
        callbacks.set(frameId, callback);
        return frameId;
      },
      cancel: (frameId: number) => {
        callbacks.delete(frameId);
      },
    },
    flush: () => {
      const pending = [...callbacks.values()];
      callbacks.clear();
      for (const callback of pending) {
        callback();
      }
    },
  };
}

describe('indicator refresh coordinator', () => {
  it('coalesces rapid refresh triggers into one animation frame', () => {
    const frames = createFakeFrameScheduler();
    let refreshCount = 0;
    const coordinator = createIndicatorRefreshCoordinator(() => {
      refreshCount += 1;
    }, frames.scheduler);

    expect(coordinator.requestRefresh()).toBe(true);
    expect(coordinator.requestRefresh()).toBe(false);
    expect(coordinator.requestRefresh()).toBe(false);
    expect(frames.callbacks.size).toBe(1);

    frames.flush();

    expect(refreshCount).toBe(1);
    expect(coordinator.hasPendingRefresh()).toBe(false);
  });

  it('does not schedule another frame after a refresh finishes', () => {
    const frames = createFakeFrameScheduler();
    const coordinator = createIndicatorRefreshCoordinator(() => undefined, frames.scheduler);

    coordinator.requestRefresh();
    frames.flush();

    expect(frames.callbacks.size).toBe(0);
    expect(coordinator.hasPendingRefresh()).toBe(false);
  });

  it('cancels a pending refresh during cleanup', () => {
    const frames = createFakeFrameScheduler();
    let refreshCount = 0;
    const coordinator = createIndicatorRefreshCoordinator(() => {
      refreshCount += 1;
    }, frames.scheduler);

    coordinator.requestRefresh();
    coordinator.cancelPendingRefresh();
    frames.flush();

    expect(refreshCount).toBe(0);
    expect(coordinator.hasPendingRefresh()).toBe(false);
  });
});
