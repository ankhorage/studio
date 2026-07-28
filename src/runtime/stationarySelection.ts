import { ZORA_COMPONENT_REGISTRY } from '@ankhorage/zora';
import React from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import type { StationarySelectionCoordinator } from './stationarySelectionCoordinator.js';
import { createStationarySelectionCoordinator } from './stationarySelectionCoordinator.js';

export type {
  CommitSelectionResult,
  StationarySelectionCoordinator,
  TransactionState,
} from './stationarySelectionCoordinator.js';

interface TrackerContextValue {
  readonly recordNode: (nodeId: string) => void;
}

const TrackerContext = React.createContext<TrackerContextValue | null>(null);

function StudioNodeTouchRecorder(props: {
  readonly nodeId: string | undefined;
  readonly showUnsupportedIndicator: boolean;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const ctx = React.useContext(TrackerContext);
  const nodeIdRef = React.useRef(props.nodeId);

  nodeIdRef.current = props.nodeId;

  function handleTouchStart(): void {
    if (!ctx) {
      return;
    }

    const nodeId = nodeIdRef.current;

    if (!nodeId) {
      return;
    }

    ctx.recordNode(nodeId);
  }

  return React.createElement(
    View,
    {
      style: { display: 'contents' },
      onTouchStart: handleTouchStart,
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
  const coordinatorRef = React.useRef<StationarySelectionCoordinator | null>(null);

  coordinatorRef.current ??= createStationarySelectionCoordinator();

  const coordinator = coordinatorRef.current;

  const isEditModeRef = React.useRef(props.isEditMode);
  const selectedNodeIdRef = React.useRef(props.selectedNodeId);
  const selectNodeRef = React.useRef(props.selectNode);
  const generationRef = React.useRef(0);

  isEditModeRef.current = props.isEditMode;
  selectedNodeIdRef.current = props.selectedNodeId;
  selectNodeRef.current = props.selectNode;

  const contextValue = React.useMemo(
    () => ({
      recordNode: (nodeId: string) => coordinator.recordNode(nodeId, generationRef.current),
    }),
    [coordinator],
  );

  const tapGesture = React.useMemo(() => {
    return Gesture.Tap()
      .maxDeltaX(5)
      .maxDeltaY(5)
      .maxDuration(500)
      .runOnJS(true)
      .onBegin(() => {
        generationRef.current = coordinator.beginTransaction();
      })
      .onEnd((_event, success) => {
        if (!success) {
          return;
        }

        coordinator.commitSelection(
          isEditModeRef.current,
          selectedNodeIdRef.current,
          selectNodeRef.current,
          generationRef.current,
        );
      })
      .onFinalize(() => {
        coordinator.clearTransaction(generationRef.current);
      });
  }, [coordinator]);

  React.useEffect(() => {
    coordinator.clearTransaction();
  }, [props.isEditMode, coordinator]);

  return React.createElement(
    TrackerContext.Provider,
    { value: contextValue },
    React.createElement(
      GestureDetector,
      { gesture: tapGesture },
      React.createElement(View, { style: { flex: 1 } }, props.children),
    ),
  );
}

export { StationaryTapSelector };
