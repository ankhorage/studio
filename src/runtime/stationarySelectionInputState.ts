export interface StationaryPointerInput {
  readonly kind: 'pointer';
  readonly button: number;
  readonly interactionId: number;
  readonly isPrimary: boolean;
  readonly pointerId: number;
  readonly pointerType: string;
}

export interface StationaryTouchInput {
  readonly kind: 'touch';
  readonly interactionId: number;
  readonly touchId: string;
}

export type StationarySelectionInput = StationaryPointerInput | StationaryTouchInput;

export interface StationarySelectionInputState {
  recordNode(nodeId: string, input: StationarySelectionInput): boolean;
  beginTransaction(recordNode: (nodeId: string) => void): void;
  completePendingInteraction(): void;
  clear(): void;
  getPendingPath(): readonly string[];
}

/***
 * Return whether a pointer input is primary and, for mouse input, uses the primary button.
 * @utility @ankhorage/utility/interaction
 */
function isSupportedPointerInput(input: StationaryPointerInput): boolean {
  if (!input.isPrimary) return false;
  return input.pointerType !== 'mouse' || input.button === 0;
}

/***
 * Build a stable interaction key from pointer/touch identity plus interaction timestamp/id.
 * @utility @ankhorage/utility/interaction
 */
function getInteractionKey(input: StationarySelectionInput): string {
  return input.kind === 'pointer'
    ? `pointer:${input.pointerId}:${input.interactionId}`
    : `touch:${input.touchId}:${input.interactionId}`;
}

/***
 * Buffer unique node identifiers per pointer/touch interaction until an active transaction can consume them.
 * @utility @ankhorage/utility/interaction
 */
export function createStationarySelectionInputState(args: {
  readonly hasActiveTransaction: () => boolean;
  readonly recordActiveNode: (nodeId: string) => void;
}): StationarySelectionInputState {
  let pendingInteractionKey: string | null = null;
  let pendingPath: string[] = [];

  /*** Reset the pending interaction identity and buffered path. */
  function clear(): void {
    pendingInteractionKey = null;
    pendingPath = [];
  }

  /*** Record one node either into the active transaction or into the pending path for the current supported interaction. */
  function recordNode(nodeId: string, input: StationarySelectionInput): boolean {
    if (input.kind === 'pointer' && !isSupportedPointerInput(input)) return false;

    if (args.hasActiveTransaction()) {
      args.recordActiveNode(nodeId);
      return true;
    }

    const interactionKey = getInteractionKey(input);
    if (pendingInteractionKey !== interactionKey) {
      pendingInteractionKey = interactionKey;
      pendingPath = [];
    }

    if (!pendingPath.includes(nodeId)) pendingPath.push(nodeId);
    return true;
  }

  /*** Replay the pending path into a newly begun transaction and clear the buffer. */
  function beginTransaction(recordNode: (nodeId: string) => void): void {
    for (const nodeId of pendingPath) recordNode(nodeId);
    clear();
  }

  /*** Clear a pending interaction after completion when no active transaction owns it. */
  function completePendingInteraction(): void {
    if (!args.hasActiveTransaction()) clear();
  }

  return {
    recordNode,
    beginTransaction,
    completePendingInteraction,
    clear,
    /*** Return the currently buffered node path. */
    getPendingPath: () => pendingPath,
  };
}
