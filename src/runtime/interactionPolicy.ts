import { type RuntimeNodePropsResolver } from '@ankhorage/runtime';
import { ZORA_COMPONENT_REGISTRY } from '@ankhorage/zora';

import type { ThirdPartyComponentSupport } from './interactionPolicyCore.js';
import {
  composeInteractionPolicyResolver,
  createInteractionPolicyResolver,
} from './interactionPolicyCore.js';

export type { InteractionPolicy, ThirdPartyComponentSupport } from './interactionPolicyCore.js';

export interface StudioInteractionPolicyResolverArgs {
  readonly previewMode: boolean;
  readonly thirdPartySupport?: ThirdPartyComponentSupport;
  readonly existingResolver?: RuntimeNodePropsResolver;
}

export function createStudioInteractionPolicyResolver(
  args: StudioInteractionPolicyResolverArgs,
): RuntimeNodePropsResolver {
  const { previewMode, thirdPartySupport, existingResolver } = args;

  const resolver = createInteractionPolicyResolver({
    previewMode,
    thirdPartySupport,
    isSupportedNodeType: (nodeType) =>
      Object.prototype.hasOwnProperty.call(ZORA_COMPONENT_REGISTRY, nodeType),
  });

  return existingResolver
    ? composeInteractionPolicyResolver(resolver, existingResolver)
    : composeInteractionPolicyResolver(resolver);
}
