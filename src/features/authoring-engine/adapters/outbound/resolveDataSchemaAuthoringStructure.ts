import type { DataSchema, DataSchemaRegistry } from '@ankhorage/contracts';
import { resolveSchemaReference, resolveSingleSchemaType } from '@ankhorage/utility/schema';

import type {
  AuthoringDiagnostic,
  AuthoringPrimitive,
  AuthoringStructure,
} from '../../../../types/authoring-engine';

/*** Translate one Contracts DataSchema into Studio's neutral authoring structure without importing binding workflow policy. */
export function resolveDataSchemaAuthoringStructure(
  schema: DataSchema | undefined,
  schemas: DataSchemaRegistry | undefined,
  seen: ReadonlySet<string> = new Set(),
  path: readonly string[] = [],
): AuthoringStructure {
  const resolved = resolveSchemaReference(schema, schemas, seen);
  if (!resolved) {
    return unsupportedDataSchema(
      'unresolved-ref',
      'Data schema reference could not be resolved.',
      path,
    );
  }

  const finiteChoice = resolveFiniteChoice(resolved, path);
  if (finiteChoice) return finiteChoice;

  const unsupportedComposition = resolveUnsupportedComposition(resolved, path);
  if (unsupportedComposition) return unsupportedComposition;

  const scalarType = resolveSingleSchemaType(resolved.type);
  const effectiveType =
    scalarType ??
    (resolved.properties ? 'object' : undefined) ??
    (resolved.items ? 'array' : undefined);

  if (resolved.nullable === true && effectiveType !== 'null') {
    return unsupportedDataSchema(
      'nullable',
      'Nullable DataSchema values require union authoring semantics.',
      path,
    );
  }

  switch (effectiveType) {
    case 'array':
      return {
        kind: 'ordered-list',
        item: resolved.items
          ? resolveDataSchemaAuthoringStructure(resolved.items, schemas, seen, [...path, '*'])
          : unsupportedDataSchema(
              'array-item',
              'Array DataSchema is missing an item schema.',
              [...path, '*'],
            ),
      };
    case 'boolean':
    case 'integer':
    case 'null':
    case 'number':
    case 'string':
      return { kind: 'scalar', scalarType: effectiveType };
    case 'object':
      if (resolved.additionalProperties) {
        return unsupportedDataSchema(
          'record',
          'DataSchema additionalProperties requires value-map authoring semantics.',
          path,
        );
      }
      return {
        kind: 'object',
        fields: Object.entries(resolved.properties ?? {}).map(([name, field]) => ({
          name,
          optional: resolved.required?.includes(name) !== true,
          structure: resolveDataSchemaAuthoringStructure(field, schemas, seen, [...path, name]),
        })),
      };
    default:
      return unsupportedDataSchema(
        'unknown',
        'DataSchema does not declare a supported primitive, object, array, enum, or const shape.',
        path,
      );
  }
}

/*** Resolve DataSchema enum/const declarations into finite primitive choice semantics when lossless. */
function resolveFiniteChoice(
  schema: DataSchema,
  path: readonly string[],
): AuthoringStructure | undefined {
  const values = schema.enum ?? (schema.const === undefined ? undefined : [schema.const]);
  if (!values) return undefined;
  if (values.length === 0 || !values.every(isAuthoringPrimitive)) {
    return unsupportedDataSchema(
      schema.enum ? 'enum' : 'const',
      'DataSchema enum/const authoring supports primitive serializable values only.',
      path,
    );
  }
  return { kind: 'choice', values };
}

/*** Reject DataSchema composition forms that require neutral union/intersection semantics not owned by WP4. */
function resolveUnsupportedComposition(
  schema: DataSchema,
  path: readonly string[],
): AuthoringStructure | undefined {
  if (Array.isArray(schema.type) && schema.type.length > 1) {
    return unsupportedDataSchema(
      'type-union',
      'DataSchema multi-type declarations require union authoring semantics.',
      path,
    );
  }
  if (schema.oneOf && schema.oneOf.length > 0) {
    return unsupportedDataSchema(
      'oneOf',
      'DataSchema oneOf requires union authoring semantics.',
      path,
    );
  }
  if (schema.anyOf && schema.anyOf.length > 0) {
    return unsupportedDataSchema(
      'anyOf',
      'DataSchema anyOf requires union authoring semantics.',
      path,
    );
  }
  if (schema.allOf && schema.allOf.length > 0) {
    return unsupportedDataSchema(
      'allOf',
      'DataSchema allOf requires schema-composition authoring semantics.',
      path,
    );
  }
  return undefined;
}

/*** Check whether one serializable DataSchema literal fits the neutral primitive choice vocabulary. */
function isAuthoringPrimitive(value: unknown): value is AuthoringPrimitive {
  return (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string'
  );
}

/*** Preserve unsupported DataSchema semantics as an explicit neutral authoring diagnostic. */
function unsupportedDataSchema(
  sourceKind: string,
  message: string,
  path: readonly string[],
): AuthoringStructure {
  const diagnostic: AuthoringDiagnostic = {
    code: sourceKind === 'unresolved-ref' ? 'unresolved-reference' : 'unsupported-structure',
    message,
    path,
  };
  return { kind: 'unsupported', sourceKind, diagnostic };
}
