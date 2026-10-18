import { type ComponentRegistry, type RuntimeNodePropsResolver } from '@ankhorage/runtime';

import type { ThirdPartyComponentSupport } from './interactionPolicyCore.js';
import {
  composeInteractionPolicyResolver,
  createInteractionPolicyResolver,
} from './interactionPolicyCore.js';

export interface StudioInteractionPolicyResolverArgs {
  readonly componentRegistry: ComponentRegistry;
  readonly previewMode: boolean;
  readonly thirdPartySupport?: ThirdPartyComponentSupport;
  readonly existingResolver?: RuntimeNodePropsResolver;
}

/***
 * Adapt the generic interaction-policy resolver to Studio's ZORA component registry and optional existing runtime props resolver.
 * TODO: Move this concrete ZORA/runtime integration to the Studio app/runtime edge; the generic resolver/composition primitives remain Utility candidates.
 */
export function createStudioInteractionPolicyResolver(
  args: StudioInteractionPolicyResolverArgs,
): RuntimeNodePropsResolver {
  const { componentRegistry, previewMode, thirdPartySupport, existingResolver } = args;

  const resolver = createInteractionPolicyResolver({
    previewMode,
    thirdPartySupport,
    /*** Return whether a node type exists as an own property of the ZORA component registry. */
    isSupportedNodeType: (nodeType) =>
      Object.prototype.hasOwnProperty.call(componentRegistry, nodeType),
  });

  return existingResolver
    ? composeInteractionPolicyResolver(resolver, existingResolver)
    : composeInteractionPolicyResolver(resolver);
}
