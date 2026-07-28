import type { ComponentRegistry, RuntimeRendererConfig } from '@ankhorage/runtime';

import { shouldSuppressStudioRuntimeActions } from './actionSuppression';
import { createStudioInteractionPolicyResolver } from './interactionPolicy';
import { createStudioPreviewComponentRegistry } from './previewRegistry';
import { createStudioStationarySelectionWrapNode } from './stationarySelection';

export interface StudioPreviewRuntimeConfigOptions {
  readonly previewMode: boolean;
  readonly components?: ComponentRegistry;
}

export const createStudioPreviewRuntimeConfig = (
  options: StudioPreviewRuntimeConfigOptions,
): RuntimeRendererConfig => ({
  disableActions: shouldSuppressStudioRuntimeActions(options.previewMode),
  registry: createStudioPreviewComponentRegistry({ components: options.components }),
  wrapNode: createStudioStationarySelectionWrapNode({ previewMode: options.previewMode }),
  resolveNodeProps: createStudioInteractionPolicyResolver({
    previewMode: options.previewMode,
  }),
});
