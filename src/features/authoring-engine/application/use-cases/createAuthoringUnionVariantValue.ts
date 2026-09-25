import { isRecord, readOwnProperty, setOwnProperty } from '@ankhorage/utility/object';

import type { AuthoringStructure, AuthoringValue } from '../../../../types/authoring-engine';
import { createInitialAuthoringValue } from './createInitialAuthoringValue';

/*** Create one target union variant while retaining only structurally compatible shared fields. */
export function createAuthoringUnionVariantValue(args: {
  readonly currentValue: unknown;
  readonly currentStructure: AuthoringStructure | undefined;
  readonly targetStructure: AuthoringStructure;
  readonly discriminator: string;
}): AuthoringValue | undefined {
  const initial = createInitialAuthoringValue(args.targetStructure);
  if (
    !isRecord(initial) ||
    !isRecord(args.currentValue) ||
    args.currentStructure?.kind !== 'object' ||
    args.targetStructure.kind !== 'object'
  ) {
    return initial;
  }

  const value = { ...initial };
  for (const targetField of args.targetStructure.fields) {
    if (targetField.name === args.discriminator) continue;
    const currentField = args.currentStructure.fields.find(
      (candidate) => candidate.name === targetField.name,
    );
    if (
      !currentField ||
      !areAuthoringStructuresEquivalent(currentField.structure, targetField.structure)
    ) {
      continue;
    }

    const current = readOwnProperty<unknown>(args.currentValue, targetField.name);
    if (current !== undefined && isAuthoringValue(current)) {
      setOwnProperty(value, targetField.name, current);
    }
  }

  return isAuthoringValue(value) ? value : undefined;
}

/*** Compare neutral owner structures recursively without relying on field-name heuristics. */
function areAuthoringStructuresEquivalent(
  left: AuthoringStructure,
  right: AuthoringStructure,
): boolean {
  if (left.kind !== right.kind) return false;

  switch (left.kind) {
    case 'scalar':
      return right.kind === 'scalar' && left.scalarType === right.scalarType;
    case 'choice':
      return right.kind === 'choice' && equalPrimitiveLists(left.values, right.values);
    case 'object':
      return right.kind === 'object' && equalObjectFields(left.fields, right.fields);
    case 'set':
      return right.kind === 'set' && areAuthoringStructuresEquivalent(left.member, right.member);
    case 'ordered-list':
      return (
        right.kind === 'ordered-list' && areAuthoringStructuresEquivalent(left.item, right.item)
      );
    case 'value-map':
    case 'entity-registry':
      return equalKeyedStructures(left, right);
    case 'union':
      return equalUnionStructures(left, right);
    case 'unsupported':
      return (
        right.kind === 'unsupported' &&
        left.sourceKind === right.sourceKind &&
        left.diagnostic.code === right.diagnostic.code
      );
  }
}

/*** Compare primitive choices in owner-declared order and runtime identity. */
function equalPrimitiveLists(
  left: readonly (boolean | number | string | null)[],
  right: readonly (boolean | number | string | null)[],
): boolean {
  return (
    left.length === right.length && left.every((value, index) => Object.is(value, right.at(index)))
  );
}

/*** Compare fixed object field contracts including optionality and nested structure. */
function equalObjectFields(
  left: Extract<AuthoringStructure, { readonly kind: 'object' }>['fields'],
  right: Extract<AuthoringStructure, { readonly kind: 'object' }>['fields'],
): boolean {
  return (
    left.length === right.length &&
    left.every((field, index) => {
      const candidate = right.at(index);
      if (!candidate) return false;
      return (
        field.name === candidate.name &&
        field.optional === candidate.optional &&
        areAuthoringStructuresEquivalent(field.structure, candidate.structure)
      );
    })
  );
}

/*** Compare map/registry key-value semantics, including stable registry identity declarations. */
function equalKeyedStructures(
  left: Extract<AuthoringStructure, { readonly kind: 'value-map' | 'entity-registry' }>,
  right: AuthoringStructure,
): boolean {
  if (left.kind === 'value-map') {
    return (
      right.kind === 'value-map' &&
      areAuthoringStructuresEquivalent(left.key, right.key) &&
      areAuthoringStructuresEquivalent(left.value, right.value)
    );
  }
  return (
    right.kind === 'entity-registry' &&
    left.identityField === right.identityField &&
    areAuthoringStructuresEquivalent(left.key, right.key) &&
    areAuthoringStructuresEquivalent(left.value, right.value)
  );
}

/*** Compare discriminated union contracts and every variant in owner-declared order. */
function equalUnionStructures(
  left: Extract<AuthoringStructure, { readonly kind: 'union' }>,
  right: AuthoringStructure,
): boolean {
  return (
    right.kind === 'union' &&
    left.discriminator === right.discriminator &&
    left.variants.length === right.variants.length &&
    left.variants.every((variant, index) => {
      const candidate = right.variants.at(index);
      return candidate ? areAuthoringStructuresEquivalent(variant, candidate) : false;
    })
  );
}

/*** Narrow unknown serializable data to the neutral authoring mutation value domain. */
function isAuthoringValue(value: unknown): value is AuthoringValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return true;
  }
  if (Array.isArray(value)) return value.every(isAuthoringValue);
  return isRecord(value) && Object.values(value).every(isAuthoringValue);
}
