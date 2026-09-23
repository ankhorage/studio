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
import { applyAuthoringMutation } from './applyAuthoringMutation';

/*** Apply one neutral mutation against owner structure, materializing valid parents and pruning empty optional overrides. */
export function applyAuthoringMutationToStructure<T>(
  current: T,
  structure: AuthoringStructure,
  mutation: AuthoringMutation,
): AuthoringMutationResult<T> {
  if (!isRecord(current)) {
    return rejected(mutation, 'Structured authoring mutations require object state.');
  }

  if (mutation.kind === 'rename-key') {
    const validation = validateValueMapRename(structure, mutation);
    if (!validation.ok) return validation;
  }

  const prepared =
    mutation.kind === 'set'
      ? materializeMutationPath(current, structure, mutation.path, mutation)
      : { ok: true as const, value: current };
  if (!prepared.ok) return prepared;

  const applied = applyAuthoringMutation(prepared.value, mutation);
  if (!applied.ok) return applied;

  return {
    ok: true,
    value: normalizeStructuredValue(structure, applied.value, mutation.kind === 'unset') as T,
  };
}

/*** Validate one keyed rename against the owner map structure before applying it. */
function validateValueMapRename(
  structure: AuthoringStructure,
  mutation: Extract<AuthoringMutation, { readonly kind: 'rename-key' }>,
): StructuredValidationResult {
  const target = resolveStructureAtPath(structure, mutation.path);
  if (target?.kind !== 'value-map') {
    return rejected(mutation, 'Authoring key rename requires a value-map target.');
  }
  if (!isValueMapKeyAllowed(target.key, mutation.toKey)) {
    return rejected(
      mutation,
      `Value-map key "${mutation.toKey}" is not allowed by the owner structure.`,
    );
  }
  return { ok: true };
}

/*** Resolve one owner structure node at a canonical object/value-map path. */
function resolveStructureAtPath(
  structure: AuthoringStructure,
  path: readonly string[],
): AuthoringStructure | undefined {
  if (path.length === 0) return structure;
  const [segment, ...remaining] = path;
  if (!segment) return undefined;
  const child = resolveChildStructure(structure, segment);
  return child ? resolveStructureAtPath(child, remaining) : undefined;
}

/*** Materialize missing object/value-map ancestors only when the owner structure authorizes the path. */
function materializeMutationPath(
  current: Readonly<Record<string, unknown>>,
  structure: AuthoringStructure,
  path: readonly string[],
  mutation: AuthoringMutation,
): StructuredRecordResult {
  const [segment, ...remaining] = path;
  if (!segment) return rejected(mutation, 'Structured authoring mutation path is empty.');

  const childStructure = resolveChildStructure(structure, segment);
  if (!childStructure) {
    return rejected(
      mutation,
      `Authoring path segment "${segment}" is not allowed by the owner structure.`,
    );
  }
  if (remaining.length === 0) return { ok: true, value: current };

  const existing = readOwnProperty<unknown>(current, segment);
  if (existing !== undefined && !isRecord(existing)) {
    return rejected(
      mutation,
      `Cannot materialize through non-object authoring path segment "${segment}".`,
    );
  }

  const nested = materializeMutationPath(
    isRecord(existing) ? existing : {},
    childStructure,
    remaining,
    mutation,
  );
  if (!nested.ok) return nested;

  const value = { ...current };
  setOwnProperty(value, segment, nested.value);
  return { ok: true, value };
}

/*** Resolve one structural child for an object field or keyed value-map entry. */
function resolveChildStructure(
  structure: AuthoringStructure,
  segment: string,
): AuthoringStructure | undefined {
  if (structure.kind === 'object') {
    return structure.fields.find((field) => field.name === segment)?.structure;
  }
  if (structure.kind !== 'value-map' || !isValueMapKeyAllowed(structure.key, segment)) {
    return undefined;
  }
  return structure.value;
}

/*** Validate one keyed value-map path segment without guessing unsupported key semantics. */
function isValueMapKeyAllowed(structure: AuthoringStructure, key: string): boolean {
  if (key.trim().length === 0) return false;
  if (structure.kind === 'scalar' && structure.scalarType === 'string') return true;
  return (
    structure.kind === 'choice' &&
    structure.values.some((value) => typeof value === 'string' && value === key)
  );
}

/*** Normalize known owner structure recursively while preserving unknown sibling fields. */
function normalizeStructuredValue(
  structure: AuthoringStructure,
  value: unknown,
  pruneEmptyOverrides: boolean,
): unknown {
  if (!isRecord(value)) return value;

  if (structure.kind === 'object') {
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

  if (structure.kind !== 'value-map') return value;

  const normalized: Record<string, unknown> = {};
  for (const [key, current] of Object.entries(value)) {
    const next = normalizeStructuredValue(structure.value, current, pruneEmptyOverrides);
    if (pruneEmptyOverrides && shouldPruneEmptyMapValue(structure.value, next)) continue;
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

/*** Create one structure-aware mutation rejection without mutating the authored value. */
function rejected(mutation: AuthoringMutation, message: string): StructuredMutationRejection {
  return {
    ok: false,
    diagnostic: {
      code: 'mutation-rejected',
      message,
      path: mutation.path,
    },
  };
}

type StructuredRecordResult =
  | { readonly ok: true; readonly value: Readonly<Record<string, unknown>> }
  | StructuredMutationRejection;

type StructuredValidationResult = { readonly ok: true } | StructuredMutationRejection;

interface StructuredMutationRejection {
  readonly ok: false;
  readonly diagnostic: {
    readonly code: 'mutation-rejected';
    readonly message: string;
    readonly path: readonly string[];
  };
}
