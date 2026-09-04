import { createCoalescedTask } from '@ankhorage/utility/scheduling';

export interface AnimationFrameScheduler {
  readonly cancel: (frameId: number) => void;
  readonly request: (callback: () => void) => number;
}

export interface IndicatorRefreshCoordinator {
  requestRefresh(): boolean;
  cancelPendingRefresh(): void;
  hasPendingRefresh(): boolean;
}

/*** Adapt Studio's animation-frame scheduler to the canonical coalesced task utility. */
export function createIndicatorRefreshCoordinator(
  refresh: () => void,
  scheduler: AnimationFrameScheduler,
): IndicatorRefreshCoordinator {
  const task = createCoalescedTask(refresh, {
    cancel: scheduler.cancel,
    schedule: (callback) => scheduler.request(callback),
  });

  return {
    requestRefresh: task.request,
    cancelPendingRefresh: task.cancel,
    hasPendingRefresh: task.hasPending,
  };
}
