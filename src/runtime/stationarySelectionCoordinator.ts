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

/***
 * Coordinate a generation-scoped interaction transaction that records an ordered path, tracks movement/finalization, and commits one selection once.
 * @utility @ankhorage/utility/interaction
 */
export function createStationarySelectionCoordinator(): StationarySelectionCoordinator {
  let nextTransactionId = 1;
  const trackerRef = { current: null as TransactionState | null };

  /*** Start a fresh interaction transaction and return its monotonically increasing generation identifier. */
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

  /*** Record one unique candidate identifier when the supplied generation matches the active transaction. */
  function recordNode(nodeId: string, generation: number): void {
    const tx = trackerRef.current;
    if (!tx || tx.finalized || tx.transactionId !== generation) return;
    if (!tx.path.includes(nodeId)) tx.path.push(nodeId);
  }

  /*** Resolve and finalize the current transaction into one selection outcome without committing stale, moved, preview, empty, or duplicate selections. */
  function commitSelection(
    isEditMode: boolean,
    selectedNodeId: string | null,
    selectNode: (id: string | null) => void,
    generation: number,
  ): CommitSelectionResult {
    if (!isEditMode) return 'preview';
    const tx = trackerRef.current;
    if (!tx) return 'empty';
    if (tx.transactionId !== generation) return 'stale';
    if (tx.finalized) return 'already-finalized';
    if (tx.moved) return 'moved';
    if (tx.path.length === 0) return 'empty';

    const [deepestNodeId] = tx.path;
    if (deepestNodeId != null && deepestNodeId === selectedNodeId) return 'already-selected';
    if (deepestNodeId != null && deepestNodeId !== selectedNodeId) selectNode(deepestNodeId);
    tx.finalized = true;
    return 'committed';
  }

  function clearTransaction(): void;
  function clearTransaction(generation: number): void;
  /*** Clear the active transaction unconditionally or only when a supplied generation matches it. */
  function clearTransaction(generation?: number): void {
    if (generation === undefined) {
      trackerRef.current = null;
      return;
    }
    const tx = trackerRef.current;
    if (tx?.transactionId !== generation) return;
    trackerRef.current = null;
  }

  /*** Mark the matching active transaction as moved so it cannot commit a stationary selection. */
  function markMoved(generation: number): void {
    const tx = trackerRef.current;
    if (tx?.transactionId !== generation) return;
    tx.moved = true;
  }

  /*** Return the current transaction state without mutating it. */
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
