import { ZORA_COMPONENT_REGISTRY } from '@ankhorage/zora';
import React from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

export type CommitSelectionResult =
  'committed' | 'already-selected' | 'preview' | 'moved' | 'empty' | 'stale' | 'already-finalized';

export interface TransactionState {
  readonly transactionId: number;
  readonly path: string[];
  moved: boolean;
  finalized: boolean;
}

export interface StationarySelectionCoordinator {
  readonly trackerRef: React.MutableRefObject<TransactionState | null>;
  beginTransaction(): number;
  recordNode(nodeId: string): void;
  commitSelection(
    isEditMode: boolean,
    selectedNodeId: string | null,
    selectNode: (id: string | null) => void,
    generation: number,
  ): CommitSelectionResult;
  clearTransaction(): void;
  getTransaction(): TransactionState | null;
}

const TrackerContext = React.createContext<React.MutableRefObject<TransactionState | null> | null>(
  null,
);

let nextTransactionId = 1;

export function createStationarySelectionCoordinator(): StationarySelectionCoordinator {
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

  function recordNode(nodeId: string): void {
    const tx = trackerRef.current;

    if (!tx || tx.finalized) {
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

  function clearTransaction(): void {
    trackerRef.current = null;
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
    getTransaction,
  };
}

function StudioNodeTouchRecorder(props: {
  readonly nodeId: string | undefined;
  readonly showUnsupportedIndicator: boolean;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const tracker = React.useContext(TrackerContext);
  const nodeIdRef = React.useRef(props.nodeId);

  nodeIdRef.current = props.nodeId;

  function handleTouchStartCapture(): void {
    const tx = tracker?.current;

    if (!tx || tx.finalized || !nodeIdRef.current) {
      return;
    }

    if (!tx.path.includes(nodeIdRef.current)) {
      tx.path.push(nodeIdRef.current);
    }
  }

  return React.createElement(
    View,
    {
      style: { position: 'relative' },
      onTouchStart: handleTouchStartCapture,
    },
    props.showUnsupportedIndicator
      ? React.createElement(View, {
          style: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderWidth: 1,
            borderColor: '#ef4444',
            borderStyle: 'dashed',
            pointerEvents: 'none',
          },
        })
      : null,
    props.children,
  );
}

export function createStudioStationarySelectionWrapNode(options?: {
  readonly previewMode?: boolean;
  readonly thirdPartySupport?: Readonly<Record<string, true>>;
}): (args: {
  readonly node: { readonly id?: string; readonly type: string };
  readonly rendered: React.ReactNode;
  readonly isRoot: boolean;
}) => React.ReactNode {
  const { previewMode, thirdPartySupport } = options ?? {};
  const isEditMode = previewMode !== true;

  return function wrapNode(args: {
    readonly node: { readonly id?: string; readonly type: string };
    readonly rendered: React.ReactNode;
    readonly isRoot: boolean;
  }): React.ReactNode {
    if (args.isRoot || !args.node.id) {
      return args.rendered;
    }

    const isSupported =
      args.node.type in ZORA_COMPONENT_REGISTRY ||
      (thirdPartySupport != null && args.node.type in thirdPartySupport);

    const showUnsupportedIndicator = isEditMode && !isSupported;

    return React.createElement(StudioNodeTouchRecorder, {
      nodeId: args.node.id,
      showUnsupportedIndicator: showUnsupportedIndicator,
      children: args.rendered,
    });
  };
}

function StationaryTapSelector(props: {
  readonly isEditMode: boolean;
  readonly selectedNodeId: string | null;
  readonly selectNode: (id: string | null) => void;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const coordinatorRef = React.useRef(createStationarySelectionCoordinator());
  const coordinator = coordinatorRef.current;

  const isEditModeRef = React.useRef(props.isEditMode);
  const selectedNodeIdRef = React.useRef(props.selectedNodeId);
  const selectNodeRef = React.useRef(props.selectNode);

  isEditModeRef.current = props.isEditMode;
  selectedNodeIdRef.current = props.selectedNodeId;
  selectNodeRef.current = props.selectNode;

  const generationRef = React.useRef(0);

  const tapGesture = React.useMemo(() => {
    return Gesture.Tap()
      .maxDeltaX(5)
      .maxDeltaY(5)
      .maxDuration(500)
      .onStart(() => {
        generationRef.current = coordinator.beginTransaction();
      })
      .onEnd((_event, success) => {
        if (success) {
          coordinator.commitSelection(
            isEditModeRef.current,
            selectedNodeIdRef.current,
            selectNodeRef.current,
            generationRef.current,
          );
        }

        coordinator.clearTransaction();
      });
  }, [coordinator]);

  React.useEffect(() => {
    coordinator.clearTransaction();
  }, [props.isEditMode, coordinator]);

  return React.createElement(
    TrackerContext.Provider,
    { value: coordinator.trackerRef },
    React.createElement(
      GestureDetector,
      { gesture: tapGesture },
      React.createElement(View, { style: { flex: 1 } }, props.children),
    ),
  );
}

export { StationaryTapSelector };
