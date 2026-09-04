import type { RuntimeRendererConfig } from '@ankhorage/runtime';
import { invertBoolean } from '@ankhorage/utility/boolean';

/***
 * Invert a preview-mode flag to decide whether runtime actions are suppressed.
 * @utility @ankhorage/utility/boolean
 */
export const shouldSuppressStudioRuntimeActions = invertBoolean;

/***
 * Project a boolean suppression decision into a RuntimeRendererConfig.
 */
export const createStudioActionSuppressionConfig = (
  previewMode: boolean,
): RuntimeRendererConfig => ({
  disableActions: shouldSuppressStudioRuntimeActions(previewMode),
});
