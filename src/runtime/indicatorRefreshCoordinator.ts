export interface AnimationFrameScheduler {
  readonly cancel: (frameId: number) => void;
  readonly request: (callback: () => void) => number;
}

export interface IndicatorRefreshCoordinator {
  requestRefresh(): boolean;
  cancelPendingRefresh(): void;
  hasPendingRefresh(): boolean;
}

export function createIndicatorRefreshCoordinator(
  refresh: () => void,
  scheduler: AnimationFrameScheduler,
): IndicatorRefreshCoordinator {
  let pendingFrameId: number | null = null;

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
    hasPendingRefresh: () => pendingFrameId !== null,
  };
}
