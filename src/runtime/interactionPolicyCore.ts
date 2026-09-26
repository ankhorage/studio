import { isSupportedKey, resolveSupportedPolicy } from '@ankhorage/utility/classification';
import { withOwnProperty } from '@ankhorage/utility/object';

export type InteractionPolicy = 'enabled' | 'passive';
export type ThirdPartyComponentSupport = Readonly<Record<string, true>>;

export interface InteractionPolicyResolverArgs {
  readonly previewMode: boolean;
  readonly thirdPartySupport?: ThirdPartyComponentSupport;
  readonly isSupportedNodeType: (nodeType: string) => boolean;
}

const EMPTY_THIRD_PARTY: ThirdPartyComponentSupport = {};

/***
 * Return whether a string key is accepted by either a primary predicate or an explicit supported-key record.
 */
export function isComponentSupported(
  nodeType: string,
  thirdPartySupport: ThirdPartyComponentSupport,
  isSupportedNodeType: (type: string) => boolean,
): boolean {
  return isSupportedKey(nodeType, isSupportedNodeType, thirdPartySupport);
}

/***
 * Resolve a two-state policy for supported values while returning undefined for unsupported values.
 */
function resolveInteractionPolicy(
  nodeType: string,
  previewMode: boolean,
  thirdPartySupport: ThirdPartyComponentSupport,
  isSupportedNodeType: (type: string) => boolean,
): InteractionPolicy | undefined {
  return resolveSupportedPolicy({
    key: nodeType,
    active: previewMode,
    activePolicy: 'enabled',
    inactivePolicy: 'passive',
    isPrimary: isSupportedNodeType,
    explicitSupport: thirdPartySupport,
  });
}

const POLICY_PROP = 'interactionPolicy';

export interface InteractionPolicyResolveArgs<TNode extends { type: string } = { type: string }> {
  readonly node: TNode;
  readonly props: Record<string, unknown>;
}

export type InteractionPolicyNodePropsResolver<TNode extends { type: string } = { type: string }> =
  (resolveArgs: InteractionPolicyResolveArgs<TNode>) => Record<string, unknown>;

/***
 * Create a props resolver that conditionally injects one derived property based on node classification and preview state.
 */
export function createInteractionPolicyResolver(
  args: InteractionPolicyResolverArgs,
): InteractionPolicyNodePropsResolver {
  const { previewMode, thirdPartySupport = EMPTY_THIRD_PARTY, isSupportedNodeType } = args;

  /*** Resolve one node's props and add the interaction-policy field only for supported node types. */
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

    return withOwnProperty(baseProps, POLICY_PROP, policy);
  };
}

export function composeInteractionPolicyResolver(
  interactionPolicyResolver: InteractionPolicyNodePropsResolver,
): InteractionPolicyNodePropsResolver;
export function composeInteractionPolicyResolver<TNode extends { type: string }>(
  interactionPolicyResolver: InteractionPolicyNodePropsResolver,
  existingResolver: InteractionPolicyNodePropsResolver<TNode>,
): InteractionPolicyNodePropsResolver<TNode>;
/***
 * Compose an existing props resolver before a second resolver, or return the second resolver unchanged when no predecessor exists.
 * @utility @ankhorage/utility/function
 */
export function composeInteractionPolicyResolver<TNode extends { type: string }>(
  interactionPolicyResolver: InteractionPolicyNodePropsResolver,
  existingResolver?: InteractionPolicyNodePropsResolver<TNode>,
): InteractionPolicyNodePropsResolver<TNode> {
  if (!existingResolver) {
    return interactionPolicyResolver;
  }

  /*** Resolve props through the existing resolver before passing them into the interaction-policy resolver. */
  return (resolveArgs) =>
    interactionPolicyResolver({
      node: resolveArgs.node,
      props: existingResolver(resolveArgs),
    });
}
