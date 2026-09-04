import type { RuntimeRendererConfig } from '@ankhorage/runtime';

/***
 * Invert a preview-mode flag to decide whether runtime actions are suppressed.
 * @utility @ankhorage/utility/boolean
 */
export const shouldSuppressStudioRuntimeActions = (previewMode: boolean): boolean => !previewMode;

/***
 * Project a boolean suppression decision into a RuntimeRendererConfig.
 * @todo Move this Studio/runtime adapter beside the runtime integration owner; the underlying boolean inversion is Utility.
 */
export const createStudioActionSuppressionConfig = (
  previewMode: boolean,
): RuntimeRendererConfig => ({
  disableActions: shouldSuppressStudioRuntimeActions(previewMode),
});
