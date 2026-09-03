import { type RuntimeNodePropsResolver } from '@ankhorage/runtime';
import { ZORA_COMPONENT_REGISTRY } from '@ankhorage/zora';

import type { ThirdPartyComponentSupport } from './interactionPolicyCore.js';
import {
  composeInteractionPolicyResolver,
  createInteractionPolicyResolver,
} from './interactionPolicyCore.js';

export interface StudioInteractionPolicyResolverArgs {
  readonly previewMode: boolean;
  readonly thirdPartySupport?: ThirdPartyComponentSupport;
  readonly existingResolver?: RuntimeNodePropsResolver;
}

/***
 * Adapt the generic interaction-policy resolver to Studio's ZORA component registry and optional existing runtime props resolver.
 * @todo Move this concrete ZORA/runtime integration to the Studio app/runtime edge; the generic resolver/composition primitives remain Utility candidates.
 */
export function createStudioInteractionPolicyResolver(
  args: StudioInteractionPolicyResolverArgs,
): RuntimeNodePropsResolver {
  const { previewMode, thirdPartySupport, existingResolver } = args;

  const resolver = createInteractionPolicyResolver({
    previewMode,
    thirdPartySupport,
    /*** Return whether a node type exists as an own property of the ZORA component registry. */
    isSupportedNodeType: (nodeType) =>
      Object.prototype.hasOwnProperty.call(ZORA_COMPONENT_REGISTRY, nodeType),
  });

  return existingResolver
    ? composeInteractionPolicyResolver(resolver, existingResolver)
    : composeInteractionPolicyResolver(resolver);
}
