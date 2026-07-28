import { ZORA_COMPONENT_REGISTRY } from '@ankhorage/zora';
import React from 'react';
import { View } from 'react-native';
import { State, TapGestureHandler } from 'react-native-gesture-handler';

export interface TransactionState {
  readonly transactionId: number;
  readonly path: string[];
  moved: boolean;
  finalized: boolean;
}

export interface StationarySelectionCoordinator {
  readonly trackerRef: React.MutableRefObject<TransactionState | null>;
  beginTransaction(): void;
  recordNode(nodeId: string): void;
  markMoved(): void;
  commitSelection(
    isEditMode: boolean,
    selectedNodeId: string | null,
    selectNode: (id: string | null) => void,
  ): void;
  clearTransaction(): void;
  getTransaction(): TransactionState | null;
  handleStateChange(
    state: number,
    isEditMode: boolean,
    selectedNodeId: string | null,
    selectNode: (id: string | null) => void,
  ): void;
}

const TrackerContext = React.createContext<React.MutableRefObject<TransactionState | null> | null>(
  null,
);

export function createStationarySelectionCoordinator(): StationarySelectionCoordinator {
  const trackerRef = { current: null as TransactionState | null };

  function beginTransaction(): void {
    trackerRef.current = {
      transactionId: Date.now(),
      path: [],
      moved: false,
      finalized: false,
    };
  }

  function recordNode(nodeId: string): void {
    const tx = trackerRef.current;

    if (!tx || tx.transactionId === 0 || tx.finalized) {
      return;
    }

    if (!tx.path.includes(nodeId)) {
      tx.path.push(nodeId);
    }
  }

  function markMoved(): void {
    if (trackerRef.current) {
      trackerRef.current.moved = true;
    }
  }

  function commitSelection(
    isEditMode: boolean,
    selectedNodeId: string | null,
    selectNode: (id: string | null) => void,
  ): void {
    if (!isEditMode) {
      return;
    }

    const tx = trackerRef.current;

    if (!tx || tx.finalized || tx.moved || tx.path.length === 0) {
      return;
    }

    const [deepestNodeId] = tx.path;

    if (deepestNodeId != null && deepestNodeId !== selectedNodeId) {
      selectNode(deepestNodeId);
    }

    tx.finalized = true;
  }

  function clearTransaction(): void {
    trackerRef.current = null;
  }

  function handleStateChange(
    state: number,
    isEditMode: boolean,
    selectedNodeId: string | null,
    selectNode: (id: string | null) => void,
  ): void {
    if (state === State.BEGAN) {
      beginTransaction();
    }

    if (state === State.ACTIVE) {
      commitSelection(isEditMode, selectedNodeId, selectNode);
      clearTransaction();
    }

    if (state === State.FAILED || state === State.CANCELLED || state === State.END) {
      clearTransaction();
    }
  }

  function getTransaction(): TransactionState | null {
    return trackerRef.current;
  }

  return {
    trackerRef,
    beginTransaction,
    recordNode,
    markMoved,
    commitSelection,
    clearTransaction,
    handleStateChange,
    getTransaction,
  };
}

function StudioNodeTouchRecorder(props: {
  readonly nodeId: string | undefined;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const tracker = React.useContext(TrackerContext);
  const nodeIdRef = React.useRef(props.nodeId);

  nodeIdRef.current = props.nodeId;

  function handleTouchStart(): void {
    if (!tracker?.current || !nodeIdRef.current) {
      return;
    }

    const tx = tracker.current;

    if (tx.transactionId === 0) {
      return;
    }

    if (!tx.path.includes(nodeIdRef.current)) {
      tx.path.push(nodeIdRef.current);
    }
  }

  function handleTouchMove(): void {
    if (!tracker?.current) {
      return;
    }

    tracker.current.moved = true;
  }

  return React.createElement(
    View,
    {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
    },
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

    if (isEditMode && !isSupported) {
      return React.createElement(
        View,
        {
          style: {
            borderWidth: 1,
            borderColor: '#ef4444',
            borderStyle: 'dashed',
          },
          pointerEvents: 'box-none',
        },
        React.createElement(StudioNodeTouchRecorder, {
          nodeId: args.node.id,
          children: args.rendered,
        }),
      );
    }

    return React.createElement(StudioNodeTouchRecorder, {
      nodeId: args.node.id,
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
  const coordinator = createStationarySelectionCoordinator();

  function handleStateChange(event: { readonly nativeEvent: { readonly state: number } }): void {
    coordinator.handleStateChange(
      event.nativeEvent.state,
      props.isEditMode,
      props.selectedNodeId,
      props.selectNode,
    );
  }

  React.useEffect(() => {
    coordinator.clearTransaction();
  }, [props.isEditMode]);

  return React.createElement(
    TrackerContext.Provider,
    { value: coordinator.trackerRef },
    React.createElement(
      TapGestureHandler,
      {
        maxDeltaX: 5,
        maxDeltaY: 5,
        maxDurationMs: 500,
        onHandlerStateChange: handleStateChange,
      },
      React.createElement(View, { style: { flex: 1 } }, props.children),
    ),
  );
}

export { StationaryTapSelector };
