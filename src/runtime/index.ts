import React from 'react';

import { StationaryTapSelector as BaseStationaryTapSelector } from './stationarySelection.js';

export * from './actionSuppression.js';
export * from './appExtensionRegistry.js';
export * from './interactionPolicy.js';
export * from './interactionPolicyCore.js';
export * from './registry.js';
export * from './runtimeActions.js';
export {
  createStudioStationarySelectionWrapNode,
  useStudioUnsupportedNodeMeasurement,
} from './stationarySelection.js';
export type { StudioCanvasInteractionAdapter } from './stationarySelection.js';
export * from './stationarySelectionCoordinator.js';
export * from './useRuntimeAction.js';

let stationaryTapSelectorDebugInstance = 0;

export function StationaryTapSelector(
  props: React.ComponentProps<typeof BaseStationaryTapSelector>,
): React.JSX.Element {
  const instanceIdRef = React.useRef<number | null>(null);
  instanceIdRef.current ??= ++stationaryTapSelectorDebugInstance;
  const instanceId = instanceIdRef.current;
  const renderCountRef = React.useRef(0);
  renderCountRef.current += 1;

  console.info('[studio-native-debug] StationaryTapSelector render', {
    instanceId,
    renderCount: renderCountRef.current,
    isEditMode: props.isEditMode,
    selectedNodeId: props.selectedNodeId,
    hasCanvasInteraction: props.canvasInteraction !== undefined,
  });

  React.useEffect(() => {
    console.info('[studio-native-debug] StationaryTapSelector effect mounted', { instanceId });
    return () => {
      console.info('[studio-native-debug] StationaryTapSelector effect cleanup', { instanceId });
    };
  }, [instanceId]);

  return React.createElement(BaseStationaryTapSelector, props);
}
