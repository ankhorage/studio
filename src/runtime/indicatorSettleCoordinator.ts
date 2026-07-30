interface IndicatorSettleScheduler<Handle> {
  readonly cancel: (handle: Handle) => void;
  readonly schedule: (callback: () => void, delayMs: number) => Handle;
}

export interface IndicatorSettleCoordinator {
  cancel(): void;
  isActive(): boolean;
  trigger(): boolean;
}

export interface IndicatorSettleCoordinatorOptions<Snapshot, Handle> {
  readonly areEqual: (left: Snapshot, right: Snapshot) => boolean;
  readonly intervalMs: number;
  readonly maxSamples: number;
  readonly sample: () => Promise<Snapshot | null>;
  readonly scheduler: IndicatorSettleScheduler<Handle>;
  readonly stableSampleCount: number;
}

export function createIndicatorSettleCoordinator<Snapshot, Handle>(
  options: IndicatorSettleCoordinatorOptions<Snapshot, Handle>,
): IndicatorSettleCoordinator {
  let active = false;
  let pendingHandle: Handle | null = null;
  let sampling = false;
  let revision = 0;
  let sampleCount = 0;
  let stableSampleCount = 0;
  let previousSnapshot: Snapshot | null = null;

  function clearPending(): void {
    if (pendingHandle === null) {
      return;
    }
    options.scheduler.cancel(pendingHandle);
    pendingHandle = null;
  }

  function cancel(): void {
    active = false;
    revision += 1;
    sampleCount = 0;
    stableSampleCount = 0;
    previousSnapshot = null;
    clearPending();
  }

  function scheduleNext(delayMs: number): void {
    if (!active || sampling || pendingHandle !== null) {
      return;
    }
    pendingHandle = options.scheduler.schedule(() => {
      pendingHandle = null;
      void sampleNext();
    }, delayMs);
  }

  async function sampleNext(): Promise<void> {
    if (!active || sampling) {
      return;
    }

    const sampleRevision = revision;
    sampling = true;
    const snapshot = await options.sample();
    sampling = false;

    if (sampleRevision !== revision) {
      scheduleNext(0);
      return;
    }
    if (snapshot === null) {
      cancel();
      return;
    }

    sampleCount += 1;
    if (previousSnapshot !== null && options.areEqual(previousSnapshot, snapshot)) {
      stableSampleCount += 1;
    } else {
      stableSampleCount = 1;
    }
    previousSnapshot = snapshot;

    if (stableSampleCount >= options.stableSampleCount || sampleCount >= options.maxSamples) {
      cancel();
      return;
    }

    scheduleNext(options.intervalMs);
  }

  return {
    cancel,
    isActive: () => active,
    trigger: () => {
      const wasActive = active;
      active = true;
      revision += 1;
      sampleCount = 0;
      stableSampleCount = 0;
      previousSnapshot = null;
      scheduleNext(0);
      return !wasActive;
    },
  };
}
