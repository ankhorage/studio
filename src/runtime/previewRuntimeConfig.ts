import type { ComponentRegistry, RuntimeRendererConfig } from '@ankhorage/runtime';

import { shouldSuppressStudioRuntimeActions } from './actionSuppression';
import { createStudioPreviewComponentRegistry } from './previewRegistry';

export interface StudioPreviewRuntimeConfigOptions {
  readonly previewMode: boolean;
  readonly components?: ComponentRegistry;
}

export const createStudioPreviewRuntimeConfig = (
  options: StudioPreviewRuntimeConfigOptions,
): RuntimeRendererConfig => ({
  disableActions: shouldSuppressStudioRuntimeActions(options.previewMode),
  registry: createStudioPreviewComponentRegistry({ components: options.components }),
});
