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

function isSupportedPointerInput(input: StationaryPointerInput): boolean {
  if (!input.isPrimary) {
    return false;
  }

  return input.pointerType !== 'mouse' || input.button === 0;
}

function getInteractionKey(input: StationarySelectionInput): string {
  return input.kind === 'pointer'
    ? `pointer:${input.pointerId}:${input.interactionId}`
    : `touch:${input.touchId}:${input.interactionId}`;
}

export function createStationarySelectionInputState(args: {
  readonly hasActiveTransaction: () => boolean;
  readonly recordActiveNode: (nodeId: string) => void;
}): StationarySelectionInputState {
  let pendingInteractionKey: string | null = null;
  let pendingPath: string[] = [];

  function clear(): void {
    pendingInteractionKey = null;
    pendingPath = [];
  }

  function recordNode(nodeId: string, input: StationarySelectionInput): boolean {
    if (input.kind === 'pointer' && !isSupportedPointerInput(input)) {
      return false;
    }

    if (args.hasActiveTransaction()) {
      args.recordActiveNode(nodeId);
      return true;
    }

    const interactionKey = getInteractionKey(input);
    if (pendingInteractionKey !== interactionKey) {
      pendingInteractionKey = interactionKey;
      pendingPath = [];
    }

    if (!pendingPath.includes(nodeId)) {
      pendingPath.push(nodeId);
    }
    return true;
  }

  function beginTransaction(recordNode: (nodeId: string) => void): void {
    for (const nodeId of pendingPath) {
      recordNode(nodeId);
    }
    clear();
  }

  function completePendingInteraction(): void {
    if (!args.hasActiveTransaction()) {
      clear();
    }
  }

  return {
    recordNode,
    beginTransaction,
    completePendingInteraction,
    clear,
    getPendingPath: () => pendingPath,
  };
}
