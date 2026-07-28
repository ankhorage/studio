import type { RuntimeResolveNodePropsArgs } from '@ankhorage/contracts/runtime';
import { type RuntimeNodePropsResolver } from '@ankhorage/runtime';
import { ZORA_COMPONENT_REGISTRY } from '@ankhorage/zora';

export type InteractionPolicy = 'enabled' | 'passive';
export type ThirdPartyComponentSupport = Readonly<Record<string, true>>;

export interface StudioInteractionPolicyResolverArgs {
  readonly previewMode: boolean;
  readonly thirdPartySupport?: ThirdPartyComponentSupport;
  readonly existingResolver?: RuntimeNodePropsResolver;
}

const EMPTY_THIRD_PARTY: ThirdPartyComponentSupport = {};

type ComponentClassification = 'zora-builtin' | 'third-party-supported' | 'unsupported';

function classifyComponent(
  nodeType: string,
  thirdPartySupport: ThirdPartyComponentSupport,
): ComponentClassification {
  if (nodeType in ZORA_COMPONENT_REGISTRY) {
    return 'zora-builtin';
  }

  if (nodeType in thirdPartySupport) {
    return 'third-party-supported';
  }

  return 'unsupported';
}

export function isComponentSupported(
  nodeType: string,
  thirdPartySupport: ThirdPartyComponentSupport,
): boolean {
  return classifyComponent(nodeType, thirdPartySupport) !== 'unsupported';
}

function resolveInteractionPolicy(
  nodeType: string,
  previewMode: boolean,
  thirdPartySupport: ThirdPartyComponentSupport,
): InteractionPolicy | undefined {
  const classification = classifyComponent(nodeType, thirdPartySupport);

  if (classification === 'unsupported') {
    return undefined;
  }

  return previewMode ? 'enabled' : 'passive';
}

const POLICY_PROP = 'interactionPolicy';

export function createStudioInteractionPolicyResolver(
  args: StudioInteractionPolicyResolverArgs,
): RuntimeNodePropsResolver {
  const { previewMode, thirdPartySupport = EMPTY_THIRD_PARTY, existingResolver } = args;

  return (resolveArgs: RuntimeResolveNodePropsArgs) => {
    const baseProps = existingResolver ? existingResolver(resolveArgs) : { ...resolveArgs.props };

    const policy = resolveInteractionPolicy(resolveArgs.node.type, previewMode, thirdPartySupport);

    if (policy === undefined) {
      return baseProps;
    }

    return {
      ...baseProps,
      [POLICY_PROP]: policy,
    };
  };
}
