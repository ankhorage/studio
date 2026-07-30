export type CommitSelectionResult =
  'committed' | 'already-selected' | 'preview' | 'moved' | 'empty' | 'stale' | 'already-finalized';

export interface TransactionState {
  readonly transactionId: number;
  readonly path: string[];
  moved: boolean;
  finalized: boolean;
}

export interface StationarySelectionCoordinator {
  readonly trackerRef: { current: TransactionState | null };
  beginTransaction(): number;
  recordNode(nodeId: string, generation: number): void;
  commitSelection(
    isEditMode: boolean,
    selectedNodeId: string | null,
    selectNode: (id: string | null) => void,
    generation: number,
  ): CommitSelectionResult;
  clearTransaction(): void;
  clearTransaction(generation: number): void;
  markMoved(generation: number): void;
  getTransaction(): TransactionState | null;
}

export function createStationarySelectionCoordinator(): StationarySelectionCoordinator {
  let nextTransactionId = 1;
  const trackerRef = { current: null as TransactionState | null };

  function beginTransaction(): number {
    const tx = {
      transactionId: nextTransactionId++,
      path: [],
      moved: false,
      finalized: false,
    };
    trackerRef.current = tx;
    return tx.transactionId;
  }

  function recordNode(nodeId: string, generation: number): void {
    const tx = trackerRef.current;

    if (!tx || tx.finalized || tx.transactionId !== generation) {
      return;
    }

    if (!tx.path.includes(nodeId)) {
      tx.path.push(nodeId);
    }
  }

  function commitSelection(
    isEditMode: boolean,
    selectedNodeId: string | null,
    selectNode: (id: string | null) => void,
    generation: number,
  ): CommitSelectionResult {
    if (!isEditMode) {
      return 'preview';
    }

    const tx = trackerRef.current;

    if (!tx) {
      return 'empty';
    }

    if (tx.transactionId !== generation) {
      return 'stale';
    }

    if (tx.finalized) {
      return 'already-finalized';
    }

    if (tx.moved) {
      return 'moved';
    }

    if (tx.path.length === 0) {
      return 'empty';
    }

    const [deepestNodeId] = tx.path;

    if (deepestNodeId != null && deepestNodeId === selectedNodeId) {
      return 'already-selected';
    }

    if (deepestNodeId != null && deepestNodeId !== selectedNodeId) {
      selectNode(deepestNodeId);
    }

    tx.finalized = true;

    return 'committed';
  }

  function clearTransaction(): void;
  function clearTransaction(generation: number): void;
  function clearTransaction(generation?: number): void {
    if (generation === undefined) {
      trackerRef.current = null;
      return;
    }

    const tx = trackerRef.current;

    if (tx?.transactionId !== generation) {
      return;
    }

    trackerRef.current = null;
  }

  function markMoved(generation: number): void {
    const tx = trackerRef.current;

    if (tx?.transactionId !== generation) {
      return;
    }

    tx.moved = true;
  }

  function getTransaction(): TransactionState | null {
    return trackerRef.current;
  }

  return {
    trackerRef,
    beginTransaction,
    recordNode,
    commitSelection,
    clearTransaction,
    markMoved,
    getTransaction,
  };
}
