import type { ComponentRegistry, RuntimeRendererConfig } from '@ankhorage/runtime';

import { shouldSuppressStudioRuntimeActions } from './actionSuppression';
import { createStudioInteractionPolicyResolver } from './interactionPolicy';
import type { ThirdPartyComponentSupport } from './interactionPolicyCore';
import { createStudioPreviewComponentRegistry } from './previewRegistry';

export interface StudioPreviewRuntimeConfigOptions {
  readonly previewMode: boolean;
  readonly components?: ComponentRegistry;
  readonly interactionPolicySupport?: ThirdPartyComponentSupport;
  readonly resolveNodeProps?: RuntimeRendererConfig['resolveNodeProps'];
}

export const createStudioPreviewRuntimeConfig = (
  options: StudioPreviewRuntimeConfigOptions,
): RuntimeRendererConfig => ({
  disableActions: shouldSuppressStudioRuntimeActions(options.previewMode),
  registry: createStudioPreviewComponentRegistry({ components: options.components }),
  resolveNodeProps: createStudioInteractionPolicyResolver({
    previewMode: options.previewMode,
    thirdPartySupport: options.interactionPolicySupport,
    existingResolver: options.resolveNodeProps,
  }),
});
