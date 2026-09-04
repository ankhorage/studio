import type {
  DataSchema,
  DataSchemaPrimitiveType,
  DataSchemaRegistry,
  UiBindableValueFieldMeta,
  UiBindableValueMeta,
} from '@ankhorage/contracts';

import type {
  StudioBindingCompatibility,
  StudioBindingResponsePathOption,
} from './bindingAuthoringContracts';
import { readOwnProperty } from './utils/readOwnProperty';

/***
 * Resolve a contracts data schema into the bindable value metadata used by Studio authoring.
 * @todo Move binding schema interpretation under src/bindings/.
 */
export function resolveStudioSchemaValueMeta(
  schema: DataSchema | undefined,
  schemas: DataSchemaRegistry | undefined,
  seen: ReadonlySet<string> = new Set(),
): UiBindableValueMeta {
  const resolved = resolveSchemaRef(schema, schemas, seen);
  if (!resolved) return { type: 'unknown' };
  const type = resolveSchemaType(resolved);
  const fields = resolveSchemaFields(resolved, schemas, seen);
  const itemType =
    type === 'array' ? resolveStudioSchemaValueMeta(resolved.items, schemas, seen).type : undefined;

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
  collectObjectPaths(schema, schemas, '', paths, new Set());
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

/***
 * Recursively append object-property response paths and their resolved binding metadata.
 * @todo Keep recursive binding response-path collection under src/bindings/.
 */
function collectObjectPaths(
  schema: DataSchema | undefined,
  schemas: DataSchemaRegistry | undefined,
  prefix: string,
  paths: StudioBindingResponsePathOption[],
  seen: Set<string>,
): void {
  const resolved = resolveSchemaRef(schema, schemas, seen);
  if (!resolved?.properties) return;
  for (const [name, property] of Object.entries(resolved.properties)) {
    const path = prefix ? `${prefix}.${name}` : name;
    paths.push({
      path,
      label: path,
      value: resolveStudioSchemaValueMeta(property, schemas, seen),
    });
    collectObjectPaths(property, schemas, path, paths, new Set(seen));
  }
}

/***
 * Resolve a schema reference recursively while preventing reference cycles.
 * @utility @ankhorage/utility/schema
 */
function resolveSchemaRef(
  schema: DataSchema | undefined,
  schemas: DataSchemaRegistry | undefined,
  seen: ReadonlySet<string>,
): DataSchema | undefined {
  const refId = schema?.ref?.id;
  if (!refId || !schemas || seen.has(refId)) return schema;
  const referenced = readOwnProperty<DataSchema>(schemas, refId);
  return referenced ? resolveSchemaRef(referenced, schemas, new Set([...seen, refId])) : schema;
}

/***
 * Project schema properties into the field metadata expected by Studio bindings.
 * @todo Keep bindable field projection under src/bindings/.
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

/***
 * Normalize a schema's format, primitive type, and structural hints into one effective value type.
 * @utility @ankhorage/utility/schema
 */
function resolveSchemaType(schema: DataSchema): UiBindableValueMeta['type'] {
  if (schema.format === 'date' || schema.format === 'date-time') return 'date';
  const rawType = resolveSingleSchemaType(schema.type);
  if (rawType === 'integer') return 'number';
  if (rawType === 'object') return schema.additionalProperties ? 'record' : 'object';
  if (
    rawType === 'array' ||
    rawType === 'boolean' ||
    rawType === 'number' ||
    rawType === 'string'
  ) {
    return rawType;
  }
  if (!rawType && schema.properties) return 'object';
  if (!rawType && schema.items) return 'array';
  return 'unknown';
}

/***
 * Return a schema primitive type only when the declaration contains exactly one effective type.
 * @utility @ankhorage/utility/schema
 */
function resolveSingleSchemaType(type: DataSchema['type']): DataSchemaPrimitiveType | undefined {
  if (typeof type === 'string') return type;
  return type?.length === 1 ? type.at(0) : undefined;
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
