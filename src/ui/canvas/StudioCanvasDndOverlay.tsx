import type { UiNode } from '@ankhorage/contracts';
import {
  Draggable,
  DraggableState,
  Droppable,
  DropProvider,
} from '@ankhorage/react-native-reanimated-dnd-web';
import { IconButton, Text, useZoraTheme } from '@ankhorage/zora';
import React from 'react';
import { View } from 'react-native';

import {
  createStudioCanvasDragPayload,
  resolveCanvasDragPreviewText,
  resolveCanvasDropZoneRect,
} from '../../canvasDragModel';
import { resolveCanvasDropZones, type CanvasDropZoneResolution } from '../../canvasDropZones';
import { findNodeById, type NodePlacement, type StudioComponentMetaRegistry } from '../../index';
import { resolveNodeLabel } from '../../insertModalModel';
import type { RuntimeNodeIndicatorRect } from '../../runtime/runtimeNodeMeasurement';
import {
  activateCanvasDrag,
  commitCanvasDrop,
  resetCanvasDragSession,
  sortCanvasDropTargetsBySpecificity,
} from './canvasDndInteraction';

export interface StudioCanvasDndOverlayProps {
  readonly activeDragNodeId: string | null;
  readonly componentMeta: StudioComponentMetaRegistry;
  readonly indicatorRects: readonly RuntimeNodeIndicatorRect[];
  readonly moveNodeToPlacement: (nodeId: string, placement: NodePlacement) => boolean;
  readonly rootNode: UiNode | null;
  readonly selectedNodeId: string | null;
  readonly setActiveDragNodeId: (nodeId: string | null) => void;
}

interface CanvasDropZoneView {
  readonly id: string;
  readonly resolution: CanvasDropZoneResolution;
  readonly rect: ReturnType<typeof resolveCanvasDropZoneRect>;
  readonly targetNode: UiNode;
}

interface CanvasDropZoneProps {
  readonly activeDropZoneId: string | null;
  readonly componentMeta: StudioComponentMetaRegistry;
  readonly moveNodeToPlacement: StudioCanvasDndOverlayProps['moveNodeToPlacement'];
  readonly resetDrag: () => void;
  readonly setActiveDropZoneId: React.Dispatch<React.SetStateAction<string | null>>;
  readonly zone: CanvasDropZoneView;
}

const MAX_DROP_CAPACITY = Number.MAX_SAFE_INTEGER;

function resetAfterDrop(callback: () => void): void {
  void Promise.resolve().then(callback);
}

function resolveDropZoneViews(args: {
  readonly componentMeta: StudioComponentMetaRegistry;
  readonly draggedNode: UiNode;
  readonly draggedRect: RuntimeNodeIndicatorRect;
  readonly indicatorRects: readonly RuntimeNodeIndicatorRect[];
  readonly rootNode: UiNode;
}): readonly CanvasDropZoneView[] {
  const zones = args.indicatorRects.flatMap((targetRect): CanvasDropZoneView[] => {
    const targetNode = findNodeById(args.rootNode, targetRect.nodeId);
    if (!targetNode) return [];

    return resolveCanvasDropZones({
      root: args.rootNode,
      targetNodeId: targetNode.id,
      draggedNode: args.draggedNode,
      componentMeta: args.componentMeta,
    }).map((resolution) => ({
      id: `${targetNode.id}:${resolution.kind}`,
      resolution,
      targetNode,
      rect: resolveCanvasDropZoneRect({
        kind: resolution.kind,
        targetRect,
        draggedRect: args.draggedRect,
      }),
    }));
  });
  return sortCanvasDropTargetsBySpecificity(zones);
}

function CanvasDropZone(props: CanvasDropZoneProps): React.JSX.Element {
  const { theme } = useZoraTheme();
  const isActive = props.activeDropZoneId === props.zone.id;
  const isValid = props.zone.resolution.status === 'valid';
  const borderColor = isValid ? theme.semantics.action.primary.base : '#dc2626';

  return (
    <Droppable
      activeStyle={{
        backgroundColor: isValid ? theme.semantics.action.primary.softBg : '#fee2e2',
      }}
      capacity={MAX_DROP_CAPACITY}
      droppableId={`studio-drop:${props.zone.id}`}
      onActiveChange={(active) =>
        props.setActiveDropZoneId((current) =>
          active ? props.zone.id : current === props.zone.id ? null : current,
        )
      }
      onDrop={(payload: unknown) => {
        commitCanvasDrop(payload, props.zone.resolution, props.moveNodeToPlacement);
        resetAfterDrop(props.resetDrag);
      }}
      style={{
        position: 'absolute',
        left: props.zone.rect.x,
        top: props.zone.rect.y,
        width: props.zone.rect.width,
        height: props.zone.rect.height,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: isActive ? 3 : 1,
        borderColor,
        borderStyle: isValid ? 'solid' : 'dashed',
        borderRadius: 4,
        opacity: isActive ? 0.92 : 0.28,
        zIndex: 1001,
      }}
    >
      {isActive ? (
        <Text align="center" color={isValid ? 'primary' : 'danger'} variant="caption">
          {isValid
            ? `${props.zone.resolution.kind} ${resolveNodeLabel({ node: props.zone.targetNode, componentMeta: props.componentMeta })}`
            : props.zone.resolution.reason.message}
        </Text>
      ) : null}
    </Droppable>
  );
}

function CanvasDragPreview(props: {
  readonly active: boolean;
  readonly label: string;
  readonly node: UiNode;
  readonly rect: RuntimeNodeIndicatorRect;
}): React.JSX.Element {
  const { theme } = useZoraTheme();
  const previewText = resolveCanvasDragPreviewText(props.node.props);

  return (
    <View
      pointerEvents="none"
      style={{
        display: props.active ? 'flex' : 'none',
        position: 'absolute',
        left: -props.rect.width + 24,
        top: 24,
        width: props.rect.width,
        minHeight: props.rect.height,
        padding: 8,
        borderWidth: 2,
        borderColor: theme.semantics.action.primary.base,
        borderRadius: 6,
        backgroundColor: theme.semantics.action.primary.softBg,
        opacity: 0.88,
      }}
    >
      <Text numberOfLines={1} variant="label" weight="semiBold">
        {props.label}
      </Text>
      {previewText ? (
        <Text numberOfLines={2} emphasis="muted" variant="bodySmall">
          {previewText}
        </Text>
      ) : null}
    </View>
  );
}

export function StudioCanvasDndOverlay(
  props: StudioCanvasDndOverlayProps,
): React.JSX.Element | null {
  const [activeDropZoneId, setActiveDropZoneId] = React.useState<string | null>(null);
  const dragStartedRef = React.useRef(false);
  const rootNode = props.rootNode;
  const selectedNode =
    rootNode && props.selectedNodeId ? findNodeById(rootNode, props.selectedNodeId) : null;
  const selectedRect = props.indicatorRects.find((rect) => rect.nodeId === props.selectedNodeId);
  const draggedNode =
    rootNode && props.activeDragNodeId ? findNodeById(rootNode, props.activeDragNodeId) : null;
  const draggedRect = props.indicatorRects.find((rect) => rect.nodeId === props.activeDragNodeId);

  React.useEffect(() => {
    if (!props.activeDragNodeId) setActiveDropZoneId(null);
  }, [props.activeDragNodeId]);

  if (!rootNode || !selectedNode || !selectedRect || selectedNode.id === rootNode.id) return null;

  const payload = createStudioCanvasDragPayload(selectedNode.id);
  const previewLabel = resolveNodeLabel({ node: selectedNode, componentMeta: props.componentMeta });
  const dropZones =
    draggedNode && draggedRect
      ? resolveDropZoneViews({
          componentMeta: props.componentMeta,
          draggedNode,
          draggedRect,
          indicatorRects: props.indicatorRects,
          rootNode,
        })
      : [];
  const resetDrag = (): void => {
    dragStartedRef.current = false;
    resetCanvasDragSession({ setActiveDropZoneId, setActiveDragNodeId: props.setActiveDragNodeId });
  };

  return (
    <DropProvider>
      <Draggable
        collisionAlgorithm="center"
        data={payload}
        draggableId={`studio-node:${selectedNode.id}`}
        onDragStart={() => activateCanvasDrag(payload, props)}
        onStateChange={(state) => {
          if (state === DraggableState.DRAGGING) dragStartedRef.current = true;
          if (dragStartedRef.current && state === DraggableState.IDLE) resetDrag();
        }}
        style={{
          position: 'absolute',
          left: selectedRect.x + selectedRect.width - 24,
          top: selectedRect.y - 24,
          width: 48,
          height: 48,
          zIndex: 1002,
        }}
      >
        <CanvasDragPreview
          active={props.activeDragNodeId !== null}
          label={previewLabel}
          node={selectedNode}
          rect={selectedRect}
        />
        <Draggable.Handle style={{ width: 48, height: 48 }}>
          <IconButton
            color="neutral"
            icon={{ name: 'move-outline' }}
            label={`Drag ${previewLabel}`}
            size="l"
            variant="solid"
          />
        </Draggable.Handle>
      </Draggable>

      {dropZones.map((zone) => (
        <CanvasDropZone
          key={zone.id}
          activeDropZoneId={activeDropZoneId}
          componentMeta={props.componentMeta}
          moveNodeToPlacement={props.moveNodeToPlacement}
          resetDrag={resetDrag}
          setActiveDropZoneId={setActiveDropZoneId}
          zone={zone}
        />
      ))}
    </DropProvider>
  );
}
