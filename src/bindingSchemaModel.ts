import type {
  DataSchema,
  DataSchemaRegistry,
  UiBindableValueFieldMeta,
  UiBindableValueMeta,
} from '@ankhorage/contracts';
import { resolveSchemaReference } from '@ankhorage/utility/schema';

import type {
  StudioBindingCompatibility,
  StudioBindingResponsePathOption,
} from './bindingAuthoringContracts';
import { resolveDataSchemaAuthoringStructure } from './features/authoring-engine/adapters/outbound/resolveDataSchemaAuthoringStructure';
import type { AuthoringStructure } from './types/authoring-engine';

/***
 * Project canonical DataSchema authoring semantics into the bindable metadata used by compatibility policy.
 * @todo Move binding schema projection under src/bindings/.
 */
export function resolveStudioSchemaValueMeta(
  schema: DataSchema | undefined,
  schemas: DataSchemaRegistry | undefined,
  seen: ReadonlySet<string> = new Set(),
): UiBindableValueMeta {
  const resolved = resolveSchemaReference(schema, schemas, seen);
  if (!resolved) return { type: 'unknown' };

  const authoring = resolveDataSchemaAuthoringStructure(resolved, schemas);
  const structure = authoring.ok ? authoring.structure : undefined;
  const type = resolveBindableType(resolved, structure);
  const fields =
    structure?.kind === 'object' ? resolveSchemaFields(resolved, schemas, seen) : [];
  const itemType =
    structure?.kind === 'ordered-list'
      ? resolveStudioSchemaValueMeta(resolved.items, schemas, seen).type
      : undefined;

  return {
    type,
    ...(fields.length > 0 ? { fields } : {}),
    ...(itemType ? { itemType } : {}),
  };
}

/***
 * Collect response-path options from a schema for Studio binding authoring.
 * @todo Move response-path authoring under src/bindings/.
 */
export function collectStudioResponsePaths(
  schema: DataSchema | undefined,
  schemas: DataSchemaRegistry | undefined,
): readonly StudioBindingResponsePathOption[] {
  const root = resolveStudioSchemaValueMeta(schema, schemas);
  const paths: StudioBindingResponsePathOption[] = [{ path: '', label: 'Response', value: root }];
  collectNestedPaths(schema, schemas, '', paths, new Set());
  return paths;
}

/***
 * Assess whether an actual bindable value shape can satisfy an expected Studio binding shape.
 * @todo Keep binding compatibility policy under src/bindings/.
 */
export function assessStudioBindingCompatibility(
  expected: UiBindableValueMeta,
  actual: UiBindableValueMeta,
): StudioBindingCompatibility {
  if (expected.type === 'unknown' || actual.type === 'unknown') return 'unknown';
  if (expected.type === actual.type) {
    if (expected.type !== 'array') return 'compatible';
    if (!expected.itemType || !actual.itemType) return 'unknown';
    return expected.itemType === actual.itemType ? 'compatible' : 'incompatible';
  }
  if (isObjectLike(expected.type) && isObjectLike(actual.type)) return 'compatible';
  if (expected.type === 'imageAsset' && isImageAssetShape(actual)) return 'compatible';
  return 'incompatible';
}

/*** Recursively append object properties and representative first-array-item response paths with resolved binding metadata. */
function collectNestedPaths(
  schema: DataSchema | undefined,
  schemas: DataSchemaRegistry | undefined,
  prefix: string,
  paths: StudioBindingResponsePathOption[],
  seen: Set<string>,
): void {
  const resolved = resolveSchemaReference(schema, schemas, seen);
  if (!resolved) return;

  const meta = resolveStudioSchemaValueMeta(resolved, schemas, seen);
  if (meta.type === 'array' && resolved.items) {
    const path = prefix ? `${prefix}.0` : '0';
    paths.push({
      path,
      label: path,
      value: resolveStudioSchemaValueMeta(resolved.items, schemas, seen),
    });
    collectNestedPaths(resolved.items, schemas, path, paths, new Set(seen));
    return;
  }

  if (!resolved.properties) return;
  for (const [name, property] of Object.entries(resolved.properties)) {
    const path = prefix ? `${prefix}.${name}` : name;
    paths.push({
      path,
      label: path,
      value: resolveStudioSchemaValueMeta(property, schemas, seen),
    });
    collectNestedPaths(property, schemas, path, paths, new Set(seen));
  }
}

/***
 * Project resolved object fields into the metadata used by binding compatibility diagnostics.
 */
function resolveSchemaFields(
  schema: DataSchema,
  schemas: DataSchemaRegistry | undefined,
  seen: ReadonlySet<string>,
): readonly UiBindableValueFieldMeta[] {
  return Object.entries(schema.properties ?? {}).map(([path, property]) => ({
    path,
    type: resolveStudioSchemaValueMeta(property, schemas, seen).type,
    required: schema.required?.includes(path) ?? false,
  }));
}

/*** Project neutral authoring structure into the older bindable-shape vocabulary without reinterpreting DataSchema shape. */
function resolveBindableType(
  schema: DataSchema,
  structure: AuthoringStructure | undefined,
): UiBindableValueMeta['type'] {
  if (schema.format === 'date' || schema.format === 'date-time') return 'date';
  if (!structure) return 'unknown';

  switch (structure.kind) {
    case 'scalar':
      if (structure.scalarType === 'integer') return 'number';
      if (
        structure.scalarType === 'boolean' ||
        structure.scalarType === 'number' ||
        structure.scalarType === 'string'
      ) {
        return structure.scalarType;
      }
      return 'unknown';
    case 'choice':
      return resolveChoiceType(structure.values);
    case 'object':
      return 'object';
    case 'ordered-list':
      return 'array';
    case 'unsupported':
      return structure.sourceKind === 'data-schema-additional-properties' ? 'record' : 'unknown';
    case 'set':
      return 'unknown';
  }
}

/*** Resolve a homogeneous finite primitive choice into the compatibility type it represents. */
function resolveChoiceType(
  values: readonly (boolean | number | string | null)[],
): UiBindableValueMeta['type'] {
  const nonNull = values.filter((value) => value !== null);
  if (nonNull.length === 0) return 'unknown';
  const first = typeof nonNull[0];
  if (!nonNull.every((value) => typeof value === first)) return 'unknown';
  if (first === 'boolean' || first === 'number' || first === 'string') return first;
  return 'unknown';
}

/***
 * Test whether a bindable value type represents an object-shaped value.
 * @todo Keep this bindable-type semantic predicate under src/bindings/.
 */
function isObjectLike(type: UiBindableValueMeta['type']): boolean {
  return type === 'object' || type === 'record';
}

/***
 * Detect the object-field shape Studio accepts as an image-asset-compatible binding value.
 * @todo Keep image-asset binding compatibility under src/bindings/.
 */
function isImageAssetShape(value: UiBindableValueMeta): boolean {
  return (
    isObjectLike(value.type) &&
    value.fields?.some((field) => field.path === 'uri' && field.type === 'string') === true
  );
}
