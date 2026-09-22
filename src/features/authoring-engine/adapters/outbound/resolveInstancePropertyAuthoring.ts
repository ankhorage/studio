import type { UiNode } from '@ankhorage/contracts';

import type {
  StudioAuthoringMetaRegistry,
  StudioAuthoringPropSchema,
} from '../../../../propertiesAuthoringModel';
import type {
  AuthoringPresentationPolicy,
  AuthoringPrimitive,
  AuthoringStructure,
} from '../../../../types/authoring-engine';

/***
 * Adapt injected owner component metadata into grouped neutral authoring definitions for one node.
 */
export function resolveInstancePropertyAuthoring(
  node: UiNode,
  registry: StudioAuthoringMetaRegistry,
) {
  const componentMeta = new Map(Object.entries(registry)).get(node.type);
  if (!componentMeta) return { componentName: node.type, groups: [] };

  const groups = new Map<
    string,
    {
      readonly name: string;
      readonly optional: boolean;
      readonly structure: AuthoringStructure;
      readonly policy: AuthoringPresentationPolicy;
    }[]
  >();

  for (const [name, schema] of Object.entries(componentMeta.props)) {
    if (schema.authoring?.authority !== 'instance') continue;
    const fields = groups.get(schema.category) ?? [];
    fields.push({
      name,
      optional: true,
      structure: resolveInstancePropertyStructure(name, schema),
      policy: resolveInstancePropertyPolicy(name, schema),
    });
    groups.set(schema.category, fields);
  }

  return {
    componentName: componentMeta.name,
    groups: Array.from(groups, ([category, fields]) => ({
      category,
      structure: {
        kind: 'object' as const,
        fields: fields.map(({ name, optional, structure }) => ({ name, optional, structure })),
      },
      policy: {
        label: category,
        fields: Object.fromEntries(fields.map(({ name, policy }) => [name, policy])),
      },
    })),
  };
}

/*** Map owner property structure into the neutral authoring vocabulary without guessing unknown types. */
function resolveInstancePropertyStructure(
  name: string,
  schema: StudioAuthoringPropSchema,
): AuthoringStructure {
  if (schema.type === 'string') return { kind: 'scalar', scalarType: 'string' };
  if (schema.type === 'number') return { kind: 'scalar', scalarType: 'number' };
  if (schema.type === 'boolean') return { kind: 'scalar', scalarType: 'boolean' };
  if (schema.type === 'enum' && (schema.enum?.length ?? 0) > 0) {
    return { kind: 'choice', values: schema.enum ?? [] };
  }
  if (schema.type === 'media') {
    return {
      kind: 'object',
      fields: [
        {
          name: 'mediaId',
          optional: true,
          structure: { kind: 'scalar', scalarType: 'string' },
        },
      ],
    };
  }

  return {
    kind: 'unsupported',
    sourceKind: schema.type,
    diagnostic: {
      code: 'unsupported-structure',
      message: `Instance property "${name}" uses unsupported owner type "${schema.type}".`,
      path: [name],
    },
  };
}

/*** Convert owner presentation metadata into neutral policy while retaining instance authority. */
function resolveInstancePropertyPolicy(
  name: string,
  schema: StudioAuthoringPropSchema,
): AuthoringPresentationPolicy {
  const inherited = resolveInstancePropertyDefault(schema);
  return {
    label: schema.label ?? name,
    ...(inherited === undefined ? {} : { inheritance: { value: inherited } }),
    ...(schema.type === 'media'
      ? {
          editor: {
            kind: 'media',
            ...(schema.mediaKinds ? { mediaKinds: schema.mediaKinds } : {}),
          },
        }
      : {}),
  };
}

/*** Return a valid primitive owner default for inheritance without coercing metadata. */
function resolveInstancePropertyDefault(
  schema: StudioAuthoringPropSchema,
): AuthoringPrimitive | undefined {
  const value = schema.default;
  if (schema.type === 'string' && typeof value === 'string') return value;
  if (schema.type === 'number' && typeof value === 'number' && Number.isFinite(value)) return value;
  if (schema.type === 'boolean' && typeof value === 'boolean') return value;
  if (
    schema.type === 'enum' &&
    (typeof value === 'string' || typeof value === 'number') &&
    schema.enum?.some((candidate) => Object.is(candidate, value))
  ) {
    return value;
  }
  return undefined;
}
