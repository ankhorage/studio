export interface NativeSelectionFrameScheduler {
  readonly cancel: (frameId: number) => void;
  readonly request: (callback: () => void) => number;
}

export interface NativeSelectionSamplingCoordinator {
  readonly isRunning: () => boolean;
  readonly start: () => boolean;
  readonly stop: () => void;
}

/*** Run one cancellable native selection measurement per frame while the caller remains eligible. */
export function createNativeSelectionSamplingCoordinator(options: {
  readonly sample: () => Promise<unknown>;
  readonly scheduler: NativeSelectionFrameScheduler;
  readonly shouldContinue: () => boolean;
}): NativeSelectionSamplingCoordinator {
  let frameId: number | null = null;
  let running = false;

  /*** Schedule the next sample only while the coordinator is active and eligible. */
  function scheduleNext(): void {
    if (!running || frameId !== null || !options.shouldContinue()) {
      running = false;
      return;
    }
    frameId = options.scheduler.request(runSample);
  }

  /*** Execute one sample and continue after it settles without allowing overlapping measurements. */
  function runSample(): void {
    frameId = null;
    if (!running || !options.shouldContinue()) {
      running = false;
      return;
    }
    void options.sample().then(scheduleNext, scheduleNext);
  }

  return {
    /*** Report whether sampling is scheduled or awaiting a measurement result. */
    isRunning: () => running,
    /*** Start sampling once and return whether this call changed the running state. */
    start() {
      if (running || !options.shouldContinue()) {
        return false;
      }
      running = true;
      scheduleNext();
      return true;
    },
    /*** Cancel the pending frame and prevent an in-flight result from scheduling another sample. */
    stop() {
      running = false;
      if (frameId !== null) {
        options.scheduler.cancel(frameId);
        frameId = null;
      }
    },
  };
}
