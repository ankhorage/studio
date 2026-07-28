import { type RuntimeNodePropsResolver } from '@ankhorage/runtime';
import { ZORA_COMPONENT_REGISTRY } from '@ankhorage/zora';

import type { ThirdPartyComponentSupport } from './interactionPolicyCore.js';
import { createInteractionPolicyResolver } from './interactionPolicyCore.js';

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
    isSupportedNodeType: (nodeType) => nodeType in ZORA_COMPONENT_REGISTRY,
  });

  if (!existingResolver) {
    return (resolveArgs) => {
      const result = resolver({
        node: resolveArgs.node,
        props: resolveArgs.props,
      });
      return result;
    };
  }

  return (resolveArgs) => {
    const baseProps = existingResolver(resolveArgs);
    const result = resolver({
      node: resolveArgs.node,
      props: baseProps,
    });
    return result;
  };
}
