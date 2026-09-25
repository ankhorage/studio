import {
  deleteOwnProperty,
  isRecord,
  readOwnProperty,
  setOwnProperty,
} from '@ankhorage/utility/object';

import type {
  AuthoringMutation,
  AuthoringMutationResult,
  AuthoringStructure,
} from '../../../../types/authoring-engine';
import { isAuthoringCollectionKeyAllowed } from '../../utils/isAuthoringCollectionKeyAllowed';
import { resolveAuthoringCollectionKey } from '../../utils/resolveAuthoringCollectionKey';
import { resolveAuthoringUnion } from '../../utils/resolveAuthoringUnion';
import { applyAuthoringMutation } from './applyAuthoringMutation';

/*** Apply one neutral mutation against owner structure, preserving collection identity and active union semantics. */
export function applyAuthoringMutationToStructure<T>(
  current: T,
  structure: AuthoringStructure,
  mutation: AuthoringMutation,
): AuthoringMutationResult<T> {
  if (mutation.kind === 'set' && mutation.path.length === 0) {
    return replaceStructuredRoot(structure, mutation) as AuthoringMutationResult<T>;
  }
  if (!isRecord(current)) {
    return rejected(mutation, 'Structured authoring mutations require object state.');
  }

  const pathValidation = validateMutationPath(structure, current, mutation.path, mutation);
  if (!pathValidation.ok) return pathValidation;

  if (mutation.kind === 'rename-key') {
    const validation = validateValueMapRename(current, structure, mutation);
    if (!validation.ok) return validation;
  }

  const prepared =
    mutation.kind === 'set'
      ? materializeMutationPath(current, structure, mutation.path, mutation)
      : { ok: true as const, value: current };
  if (!prepared.ok) return prepared;

  const applied = applyAuthoringMutation(prepared.value, mutation);
  if (!applied.ok) return applied;

  const validation = validateStructuredValue(structure, applied.value, mutation, []);
  if (!validation.ok) return validation;

  return {
    ok: true,
    value: normalizeStructuredValue(structure, applied.value, mutation.kind === 'unset') as T,
  };
}

/*** Replace an object-shaped structured root for root-level union/object variant selection. */
function replaceStructuredRoot(
  structure: AuthoringStructure,
  mutation: Extract<AuthoringMutation, { readonly kind: 'set' }>,
): AuthoringMutationResult<Readonly<Record<string, unknown>>> {
  if (!isRecord(mutation.value)) {
    return rejected(mutation, 'Root structured replacement requires object state.');
  }
  const validation = validateStructuredValue(structure, mutation.value, mutation, []);
  if (!validation.ok) return validation;
  return {
    ok: true,
    value: normalizeStructuredValue(structure, mutation.value, false) as Readonly<
      Record<string, unknown>
    >,
  };
}

/*** Reject mutations that target a stable entity identity field, including nested active unions. */
function validateMutationPath(
  structure: AuthoringStructure,
  value: unknown,
  path: readonly string[],
  mutation: AuthoringMutation,
): StructuredValidationResult {
  if (path.length === 0) return { ok: true };

  const effective = resolveEffectiveStructure(structure, value, mutation);
  if (!effective.ok) return effective;
  const [segment, ...remaining] = path;
  if (!segment) return rejected(mutation, 'Structured authoring mutation path is empty.');

  if (
    effective.structure.kind === 'entity-registry' &&
    effective.structure.identityField !== undefined &&
    remaining.at(0) === effective.structure.identityField
  ) {
    return rejected(mutation, 'Entity-registry identity fields are immutable.');
  }

  const child = resolveChildStructure(effective.structure, segment);
  if (!child || remaining.length === 0) return { ok: true };
  const childValue = isRecord(value) ? readOwnProperty<unknown>(value, segment) : undefined;
  return validateMutationPath(child, childValue, remaining, mutation);
}

/*** Validate one keyed rename against the owner map structure before applying it. */
function validateValueMapRename(
  current: Readonly<Record<string, unknown>>,
  structure: AuthoringStructure,
  mutation: Extract<AuthoringMutation, { readonly kind: 'rename-key' }>,
): StructuredValidationResult {
  const target = resolveStructureAtPath(structure, current, mutation.path, mutation);
  if (!target.ok) return target;
  if (target.structure.kind !== 'value-map') {
    return rejected(mutation, 'Authoring key rename requires a value-map target.');
  }

  const key = resolveAuthoringCollectionKey(target.structure.key);
  if (!key || !isAuthoringCollectionKeyAllowed(key, mutation.toKey)) {
    return rejected(
      mutation,
      'Value-map key "' + mutation.toKey + '" is not allowed by the owner structure.',
    );
  }
  return { ok: true };
}

/*** Resolve one owner structure node at a canonical path, selecting active union variants from state. */
function resolveStructureAtPath(
  structure: AuthoringStructure,
  value: unknown,
  path: readonly string[],
  mutation: AuthoringMutation,
): StructuredStructureResult {
  const effective = resolveEffectiveStructure(structure, value, mutation);
  if (!effective.ok || path.length === 0) return effective;

  const [segment, ...remaining] = path;
  if (!segment) return rejected(mutation, 'Structured authoring mutation path is empty.');
  const child = resolveChildStructure(effective.structure, segment);
  if (!child) return rejected(mutation, 'Unknown authoring path segment "' + segment + '".');

  const childValue = isRecord(value) ? readOwnProperty<unknown>(value, segment) : undefined;
  return resolveStructureAtPath(child, childValue, remaining, mutation);
}

/*** Materialize missing object/map/registry ancestors only when owner structure authorizes the path. */
function materializeMutationPath(
  current: Readonly<Record<string, unknown>>,
  structure: AuthoringStructure,
  path: readonly string[],
  mutation: AuthoringMutation,
): StructuredRecordResult {
  const effective = resolveEffectiveStructure(structure, current, mutation);
  if (!effective.ok) return effective;

  const [segment, ...remaining] = path;
  if (!segment) return rejected(mutation, 'Structured authoring mutation path is empty.');
  const child = resolveChildStructure(effective.structure, segment);
  if (!child) {
    return rejected(
      mutation,
      'Authoring path segment "' + segment + '" is not allowed by the owner structure.',
    );
  }
  if (remaining.length === 0) return { ok: true, value: current };

  const existing = readOwnProperty<unknown>(current, segment);
  if (existing !== undefined && !isRecord(existing)) {
    return rejected(
      mutation,
      'Cannot materialize through non-object authoring path segment "' + segment + '".',
    );
  }

  const nested = materializeMutationPath(
    isRecord(existing) ? existing : {},
    child,
    remaining,
    mutation,
  );
  if (!nested.ok) return nested;

  const value = { ...current };
  setOwnProperty(value, segment, nested.value);
  return { ok: true, value };
}

/*** Resolve an active union variant or preserve a non-union structure unchanged. */
function resolveEffectiveStructure(
  structure: AuthoringStructure,
  value: unknown,
  mutation: AuthoringMutation,
): StructuredStructureResult {
  if (structure.kind !== 'union') return { ok: true, structure };

  const resolved = resolveAuthoringUnion(structure, value, mutation.path);
  if (!resolved.ok || resolved.selected === undefined) {
    return rejected(
      mutation,
      resolved.ok
        ? 'Select a union variant before editing its fields.'
        : resolved.diagnostic.message,
    );
  }
  return { ok: true, structure: resolved.selected.structure };
}

/*** Resolve one structural child for fixed object, value-map, or entity-registry semantics. */
function resolveChildStructure(
  structure: AuthoringStructure,
  segment: string,
): AuthoringStructure | undefined {
  if (structure.kind === 'object') {
    return structure.fields.find((field) => field.name === segment)?.structure;
  }
  if (structure.kind !== 'value-map' && structure.kind !== 'entity-registry') return undefined;

  const key = resolveAuthoringCollectionKey(structure.key);
  return key && isAuthoringCollectionKeyAllowed(key, segment) ? structure.value : undefined;
}

/*** Validate registry identity and active discriminated unions after a mutation is applied. */
function validateStructuredValue(
  structure: AuthoringStructure,
  value: unknown,
  mutation: AuthoringMutation,
  path: readonly string[],
): StructuredValidationResult {
  if (value === undefined) return { ok: true };
  if (structure.kind === 'union') return validateUnionValue(structure, value, mutation, path);
  if (structure.kind === 'entity-registry') {
    return validateEntityRegistryValue(structure, value, mutation, path);
  }
  if (!isRecord(value)) return { ok: true };

  if (structure.kind === 'object') {
    for (const field of structure.fields) {
      const current = readOwnProperty<unknown>(value, field.name);
      const result = validateStructuredValue(field.structure, current, mutation, [
        ...path,
        field.name,
      ]);
      if (!result.ok) return result;
    }
  }
  if (structure.kind === 'value-map') {
    for (const [key, current] of Object.entries(value)) {
      const result = validateStructuredValue(structure.value, current, mutation, [...path, key]);
      if (!result.ok) return result;
    }
  }
  return { ok: true };
}

/*** Validate one entity registry including record key to owner identity-field consistency. */
function validateEntityRegistryValue(
  structure: Extract<AuthoringStructure, { readonly kind: 'entity-registry' }>,
  value: unknown,
  mutation: AuthoringMutation,
  path: readonly string[],
): StructuredValidationResult {
  if (!isRecord(value)) return rejectedAt(mutation, path, 'Expected entity-registry object.');
  const key = resolveAuthoringCollectionKey(structure.key);
  if (!key) return rejectedAt(mutation, path, 'Unsupported entity-registry key semantics.');

  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (!isAuthoringCollectionKeyAllowed(key, entryKey)) {
      return rejectedAt(mutation, [...path, entryKey], 'Invalid entity-registry key.');
    }
    if (structure.identityField !== undefined) {
      if (!isRecord(entryValue)) {
        return rejectedAt(
          mutation,
          [...path, entryKey],
          'Entity-registry value must be an object.',
        );
      }
      if (readOwnProperty<unknown>(entryValue, structure.identityField) !== entryKey) {
        return rejectedAt(
          mutation,
          [...path, entryKey, structure.identityField],
          'Entity-registry key must match its owner identity field.',
        );
      }
    }
    const nested = validateStructuredValue(structure.value, entryValue, mutation, [
      ...path,
      entryKey,
    ]);
    if (!nested.ok) return nested;
  }
  return { ok: true };
}

/*** Validate one union value against its selected owner variant and recurse through that structure. */
function validateUnionValue(
  structure: Extract<AuthoringStructure, { readonly kind: 'union' }>,
  value: unknown,
  mutation: AuthoringMutation,
  path: readonly string[],
): StructuredValidationResult {
  const resolved = resolveAuthoringUnion(structure, value, path);
  if (!resolved.ok || resolved.selected === undefined) {
    return rejectedAt(
      mutation,
      resolved.ok ? path : resolved.diagnostic.path,
      resolved.ok ? 'Union value has no selected variant.' : resolved.diagnostic.message,
    );
  }
  return validateStructuredValue(resolved.selected.structure, value, mutation, path);
}

/*** Normalize known owner structure recursively while preserving unknown sibling fields. */
function normalizeStructuredValue(
  structure: AuthoringStructure,
  value: unknown,
  pruneEmptyOverrides: boolean,
): unknown {
  if (!isRecord(value)) return value;

  if (structure.kind === 'union') {
    const resolved = resolveAuthoringUnion(structure, value, []);
    return resolved.ok && resolved.selected
      ? normalizeStructuredValue(resolved.selected.structure, value, pruneEmptyOverrides)
      : value;
  }
  if (structure.kind === 'object') {
    return normalizeObject(structure, value, pruneEmptyOverrides);
  }
  if (structure.kind === 'entity-registry') {
    return normalizeCollection(structure.value, value, pruneEmptyOverrides, false);
  }
  if (structure.kind === 'value-map') {
    return normalizeCollection(structure.value, value, pruneEmptyOverrides, true);
  }
  return value;
}

/*** Normalize fixed object fields and prune empty optional override containers. */
function normalizeObject(
  structure: Extract<AuthoringStructure, { readonly kind: 'object' }>,
  value: Readonly<Record<string, unknown>>,
  pruneEmptyOverrides: boolean,
): Readonly<Record<string, unknown>> {
  const normalized = { ...value };
  for (const field of structure.fields) {
    const current = readOwnProperty<unknown>(normalized, field.name);
    if (current === undefined) continue;
    const next = normalizeStructuredValue(field.structure, current, pruneEmptyOverrides);
    if (pruneEmptyOverrides && field.optional && isEmptyRecord(next)) {
      deleteOwnProperty(normalized, field.name);
    } else {
      setOwnProperty(normalized, field.name, next);
    }
  }
  return normalized;
}

/*** Normalize keyed values while pruning empty map overrides but never deleting stable entities. */
function normalizeCollection(
  valueStructure: AuthoringStructure,
  value: Readonly<Record<string, unknown>>,
  pruneEmptyOverrides: boolean,
  pruneEntries: boolean,
): Readonly<Record<string, unknown>> {
  const normalized: Record<string, unknown> = {};
  for (const [key, current] of Object.entries(value)) {
    const next = normalizeStructuredValue(valueStructure, current, pruneEmptyOverrides);
    if (pruneEntries && pruneEmptyOverrides && shouldPruneEmptyMapValue(valueStructure, next)) {
      continue;
    }
    setOwnProperty(normalized, key, next);
  }
  return normalized;
}

/*** Remove empty object-valued map entries when every owner field is optional override state. */
function shouldPruneEmptyMapValue(structure: AuthoringStructure, value: unknown): boolean {
  return (
    isEmptyRecord(value) &&
    structure.kind === 'object' &&
    structure.fields.every((field) => field.optional)
  );
}

/*** Return whether a runtime value is an empty record. */
function isEmptyRecord(value: unknown): boolean {
  return isRecord(value) && Object.keys(value).length === 0;
}

/*** Create one structure-aware mutation rejection at the mutation's requested path. */
function rejected(mutation: AuthoringMutation, message: string): StructuredMutationRejection {
  return rejectedAt(mutation, mutation.path, message);
}

/*** Create one structure-aware mutation rejection at an exact owner-semantic path. */
function rejectedAt(
  mutation: AuthoringMutation,
  path: readonly string[],
  message: string,
): StructuredMutationRejection {
  return {
    ok: false,
    diagnostic: {
      code: 'mutation-rejected',
      message,
      path,
    },
  };
}

type StructuredRecordResult =
  | { readonly ok: true; readonly value: Readonly<Record<string, unknown>> }
  | StructuredMutationRejection;

type StructuredStructureResult =
  { readonly ok: true; readonly structure: AuthoringStructure } | StructuredMutationRejection;

type StructuredValidationResult = { readonly ok: true } | StructuredMutationRejection;

interface StructuredMutationRejection {
  readonly ok: false;
  readonly diagnostic: {
    readonly code: 'mutation-rejected';
    readonly message: string;
    readonly path: readonly string[];
  };
}
