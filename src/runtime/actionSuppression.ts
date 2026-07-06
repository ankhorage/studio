import type { RuntimeRendererConfig } from '@ankhorage/runtime';

export const shouldSuppressStudioRuntimeActions = (previewMode: boolean): boolean => !previewMode;

export const createStudioActionSuppressionConfig = (
  previewMode: boolean,
): RuntimeRendererConfig => ({
  disableActions: shouldSuppressStudioRuntimeActions(previewMode),
});
