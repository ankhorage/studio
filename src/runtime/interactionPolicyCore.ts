export type InteractionPolicy = 'enabled' | 'passive';
export type ThirdPartyComponentSupport = Readonly<Record<string, true>>;

export interface InteractionPolicyResolverArgs {
  readonly previewMode: boolean;
  readonly thirdPartySupport?: ThirdPartyComponentSupport;
  readonly isSupportedNodeType: (nodeType: string) => boolean;
}

const EMPTY_THIRD_PARTY: ThirdPartyComponentSupport = {};

type ComponentClassification = 'zora-builtin' | 'third-party-supported' | 'unsupported';

function classifyComponent(
  nodeType: string,
  isSupportedNodeType: (type: string) => boolean,
  thirdPartySupport: ThirdPartyComponentSupport,
): ComponentClassification {
  if (isSupportedNodeType(nodeType)) {
    return 'zora-builtin';
  }

  if (Object.prototype.hasOwnProperty.call(thirdPartySupport, nodeType)) {
    return 'third-party-supported';
  }

  return 'unsupported';
}

export function isComponentSupported(
  nodeType: string,
  thirdPartySupport: ThirdPartyComponentSupport,
  isSupportedNodeType: (type: string) => boolean,
): boolean {
  return classifyComponent(nodeType, isSupportedNodeType, thirdPartySupport) !== 'unsupported';
}

function resolveInteractionPolicy(
  nodeType: string,
  previewMode: boolean,
  thirdPartySupport: ThirdPartyComponentSupport,
  isSupportedNodeType: (type: string) => boolean,
): InteractionPolicy | undefined {
  const classification = classifyComponent(nodeType, isSupportedNodeType, thirdPartySupport);

  if (classification === 'unsupported') {
    return undefined;
  }

  return previewMode ? 'enabled' : 'passive';
}

const POLICY_PROP = 'interactionPolicy';

export function createInteractionPolicyResolver(
  args: InteractionPolicyResolverArgs,
): (resolveArgs: {
  node: { type: string };
  props: Record<string, unknown>;
}) => Record<string, unknown> {
  const { previewMode, thirdPartySupport = EMPTY_THIRD_PARTY, isSupportedNodeType } = args;

  return (resolveArgs) => {
    const baseProps = { ...resolveArgs.props };

    const policy = resolveInteractionPolicy(
      resolveArgs.node.type,
      previewMode,
      thirdPartySupport,
      isSupportedNodeType,
    );

    if (policy === undefined) {
      return baseProps;
    }

    return {
      ...baseProps,
      [POLICY_PROP]: policy,
    };
  };
}
