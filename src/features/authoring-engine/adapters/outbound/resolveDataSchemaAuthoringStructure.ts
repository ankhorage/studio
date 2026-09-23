import type { DataSchema, DataSchemaRegistry } from '@ankhorage/contracts';

import type {
  AuthoringDiagnostic,
  AuthoringPrimitive,
  AuthoringStructure,
  AuthoringStructureResolution,
} from '../../../../types/authoring-engine';

/*** Resolve one Contracts DataSchema into the neutral authoring structure used by Studio editors. */
export function resolveDataSchemaAuthoringStructure(
  schema: DataSchema | undefined,
  schemas: DataSchemaRegistry | undefined,
): AuthoringStructureResolution {
  if (!schema) {
    return {
      ok: false,
      diagnostic: {
        code: 'unsupported-structure',
        message: 'Data schema is unavailable for authoring.',
        path: [],
      },
    };
  }

  return {
    ok: true,
    structure: resolveSchema(schema, schemas, new Set(), []),
  };
}

/*** Resolve one schema node while preserving unsupported DataSchema semantics as explicit diagnostics. */
function resolveSchema(
  schema: DataSchema,
  schemas: DataSchemaRegistry | undefined,
  visited: ReadonlySet<string>,
  path: readonly string[],
): AuthoringStructure {
  if (schema.ref) {
    return resolveReference(schema.ref.id, schemas, visited, path);
  }

  const composition = resolveCompositionKind(schema);
  if (composition) return unsupportedStructure(composition, path);

  const finite = resolveFiniteChoice(schema, path);
  if (finite) return finite;

  if (schema.nullable === true) {
    return unsupportedStructure('data-schema-nullable', path);
  }

  const primitiveType = resolvePrimitiveType(schema);
  if (primitiveType === 'union') return unsupportedStructure('data-schema-type-union', path);
  if (primitiveType === 'object') return resolveObject(schema, schemas, visited, path);
  if (primitiveType === 'array') return resolveArray(schema, schemas, visited, path);
  if (primitiveType) return { kind: 'scalar', scalarType: primitiveType };

  if (schema.properties) return resolveObject(schema, schemas, visited, path);
  if (schema.items) return resolveArray(schema, schemas, visited, path);
  return unsupportedStructure('data-schema-unknown', path);
}

/*** Resolve a referenced schema while rejecting missing and recursive references deterministically. */
function resolveReference(
  id: string,
  schemas: DataSchemaRegistry | undefined,
  visited: ReadonlySet<string>,
  path: readonly string[],
): AuthoringStructure {
  if (visited.has(id)) {
    return {
      kind: 'unsupported',
      sourceKind: 'data-schema-recursive-ref',
      diagnostic: {
        code: 'unresolved-reference',
        message: `Recursive data-schema reference "${id}" requires recursive authoring support.`,
        path,
      },
    };
  }

  const referenced = Object.entries(schemas ?? {}).find(([candidate]) => candidate === id)?.[1];
  if (!referenced) {
    return {
      kind: 'unsupported',
      sourceKind: 'data-schema-missing-ref',
      diagnostic: {
        code: 'unresolved-reference',
        message: `Data-schema reference "${id}" is unavailable.`,
        path,
      },
    };
  }

  return resolveSchema(referenced, schemas, new Set([...visited, id]), path);
}

/*** Resolve finite primitive enum/const semantics before broader primitive/container shape handling. */
function resolveFiniteChoice(
  schema: DataSchema,
  path: readonly string[],
): AuthoringStructure | undefined {
  const values = schema.const === undefined ? schema.enum : [schema.const];
  if (!values) return undefined;
  if (!values.every(isAuthoringPrimitive)) {
    return unsupportedStructure('data-schema-complex-choice', path);
  }
  return { kind: 'choice', values };
}

/*** Resolve one fixed-property DataSchema object without treating dynamic records as ordinary objects. */
function resolveObject(
  schema: DataSchema,
  schemas: DataSchemaRegistry | undefined,
  visited: ReadonlySet<string>,
  path: readonly string[],
): AuthoringStructure {
  if (schema.additionalProperties) {
    return unsupportedStructure('data-schema-additional-properties', path);
  }

  const required = new Set(schema.required ?? []);
  return {
    kind: 'object',
    fields: Object.entries(schema.properties ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, property]) => ({
        name,
        optional: !required.has(name),
        structure: resolveSchema(property, schemas, visited, [...path, name]),
      })),
  };
}

/*** Preserve DataSchema arrays as ordered-list semantics and diagnose arrays without an item schema. */
function resolveArray(
  schema: DataSchema,
  schemas: DataSchemaRegistry | undefined,
  visited: ReadonlySet<string>,
  path: readonly string[],
): AuthoringStructure {
  if (!schema.items) return unsupportedStructure('data-schema-array-without-items', path);
  return {
    kind: 'ordered-list',
    item: resolveSchema(schema.items, schemas, visited, [...path, '*']),
  };
}

/*** Return the effective DataSchema primitive type or an explicit marker for multi-type unions. */
function resolvePrimitiveType(
  schema: DataSchema,
): 'array' | 'boolean' | 'integer' | 'null' | 'number' | 'object' | 'string' | 'union' | undefined {
  if (Array.isArray(schema.type)) {
    return schema.type.length === 1 ? schema.type[0] : 'union';
  }
  return schema.type;
}

/*** Return the first composition keyword present on a DataSchema node. */
function resolveCompositionKind(schema: DataSchema): string | undefined {
  if (schema.oneOf && schema.oneOf.length > 0) return 'data-schema-one-of';
  if (schema.anyOf && schema.anyOf.length > 0) return 'data-schema-any-of';
  if (schema.allOf && schema.allOf.length > 0) return 'data-schema-all-of';
  return undefined;
}

/*** Test whether one DataSchema literal can be represented by the current neutral choice node. */
function isAuthoringPrimitive(value: unknown): value is AuthoringPrimitive {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

/*** Convert unsupported DataSchema semantics into an explicit neutral authoring diagnostic. */
function unsupportedStructure(sourceKind: string, path: readonly string[]): AuthoringStructure {
  const diagnostic: AuthoringDiagnostic = {
    code: 'unsupported-structure',
    message: `DataSchema semantic "${sourceKind}" is not supported by the current Authoring Engine.`,
    path,
  };
  return { kind: 'unsupported', sourceKind, diagnostic };
}
