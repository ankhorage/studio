import type {
  MediaAssetKind,
  MediaAssetReference,
  UiNode,
} from '@ankhorage/contracts';
import { withoutOwnProperty, withOwnProperty } from '@ankhorage/utility/object';

export interface StudioAuthoringPropSchema {
  readonly type: string;
  readonly category: string;
  readonly label?: string;
  readonly enum?: readonly (string | number)[];
  readonly mediaKinds?: readonly MediaAssetKind[];
  readonly default?: unknown;
  readonly authoring?: {
    readonly authority: string;
  };
}

export interface StudioAuthoringComponentMeta {
  readonly name: string;
  readonly props: Readonly<Record<string, StudioAuthoringPropSchema>>;
}

export type StudioAuthoringMetaRegistry = Readonly<
  Record<string, StudioAuthoringComponentMeta | undefined>
>;

export type StudioInstancePropertyValue = string | number | boolean | MediaAssetReference;

/***
 * Create an immutable props patch that removes a property for undefined or replaces it for a defined value.
 * @utility @ankhorage/utility/object
 */
export function createStudioInstancePropertyPatch(
  node: UiNode,
  propertyName: string,
  value: StudioInstancePropertyValue | undefined,
): Readonly<Record<string, unknown>> {
  const props = node.props ?? {};
  return {
    props:
      value === undefined
        ? withoutOwnProperty(props, propertyName)
        : withOwnProperty<unknown>(props, propertyName, value),
  };
}
