export interface AnimationFrameScheduler {
  readonly cancel: (frameId: number) => void;
  readonly request: (callback: () => void) => number;
}

export interface IndicatorRefreshCoordinator {
  requestRefresh(): boolean;
  cancelPendingRefresh(): void;
  hasPendingRefresh(): boolean;
}

/***
 * Coalesce refresh requests into at most one pending scheduler callback and expose cancellation/state controls.
 * @utility @ankhorage/utility/scheduling
 */
export function createIndicatorRefreshCoordinator(
  refresh: () => void,
  scheduler: AnimationFrameScheduler,
): IndicatorRefreshCoordinator {
  let pendingFrameId: number | null = null;

  /*** Schedule one refresh unless another scheduler callback is already pending. */
  function requestRefresh(): boolean {
    if (pendingFrameId !== null) {
      return false;
    }

    pendingFrameId = scheduler.request(() => {
      pendingFrameId = null;
      refresh();
    });
    return true;
  }

  /*** Cancel the pending refresh callback when one exists. */
  function cancelPendingRefresh(): void {
    if (pendingFrameId === null) {
      return;
    }
    scheduler.cancel(pendingFrameId);
    pendingFrameId = null;
  }

  return {
    requestRefresh,
    cancelPendingRefresh,
    /*** Return whether a refresh callback is currently pending. */
    hasPendingRefresh: () => pendingFrameId !== null,
  };
}
