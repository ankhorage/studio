import { isRecord, readOwnProperty } from '@ankhorage/utility/object';

import type {
  AuthoringDiagnostic,
  AuthoringPrimitive,
  AuthoringStructure,
  AuthoringUnionVariant,
} from '../../../types/authoring-engine';

interface UnionFailure {
  readonly ok: false;
  readonly diagnostic: AuthoringDiagnostic;
}

type UnionResolution =
  | {
      readonly ok: true;
      readonly discriminator: string;
      readonly variants: readonly AuthoringUnionVariant[];
      readonly selected: AuthoringUnionVariant | undefined;
    }
  | UnionFailure;

/*** Resolve one explicitly discriminated union without guessing ambiguous variant semantics. */
export function resolveAuthoringUnion(
  structure: Extract<AuthoringStructure, { readonly kind: 'union' }>,
  value: unknown,
  path: readonly string[],
): UnionResolution {
  const { discriminator } = structure;
  if (!discriminator) {
    return unsupported(path, 'Union authoring requires an explicit owner discriminator.');
  }

  const variants = structure.variants.map((variant) =>
    resolveVariant(variant, discriminator, path),
  );
  const invalid = variants.find((variant) => !variant.ok);
  if (invalid) return invalid;

  const resolved = variants
    .filter((variant): variant is Extract<typeof variant, { readonly ok: true }> => variant.ok)
    .map(({ value: discriminatorValue, structure: variant }) => ({
      value: discriminatorValue,
      structure: variant,
    }));
  if (new Set(resolved.map((variant) => encodePrimitive(variant.value))).size !== resolved.length) {
    return unsupported(path, 'Union discriminator values must identify variants uniquely.');
  }

  if (value === undefined) {
    return { ok: true, discriminator, variants: resolved, selected: undefined };
  }
  if (!isRecord(value)) {
    return invalidValue(path, 'Expected object value for discriminated union authoring.');
  }

  const authored = readOwnProperty<unknown>(value, discriminator);
  const selected = resolved.find((variant) => Object.is(variant.value, authored));
  return selected
    ? { ok: true, discriminator, variants: resolved, selected }
    : invalidValue(path, 'Unknown union discriminator value for "' + discriminator + '".');
}

/*** Resolve one object variant and its single literal discriminator value. */
function resolveVariant(
  structure: AuthoringStructure,
  discriminator: string,
  path: readonly string[],
):
  | {
      readonly ok: true;
      readonly value: AuthoringPrimitive;
      readonly structure: AuthoringStructure;
    }
  | UnionFailure {
  if (structure.kind !== 'object') {
    return unsupported(path, 'Discriminated union variants must be object structures.');
  }

  const field = structure.fields.find((candidate) => candidate.name === discriminator);
  if (!field || field.optional || field.structure.kind !== 'choice') {
    return unsupported(
      path,
      'Union variant must define required discriminator "' + discriminator + '".',
    );
  }
  const [value, extra] = field.structure.values;
  if (value === undefined || extra !== undefined) {
    return unsupported(
      path,
      'Union discriminator "' + discriminator + '" must have one literal value.',
    );
  }
  return { ok: true, value, structure };
}

/*** Encode one primitive without conflating equal string representations of different runtime types. */
function encodePrimitive(value: AuthoringPrimitive): string {
  return typeof value + ':' + JSON.stringify(value);
}

/*** Create a fail-closed unsupported-union result. */
function unsupported(path: readonly string[], message: string): UnionFailure {
  return {
    ok: false,
    diagnostic: { code: 'unsupported-structure', message, path },
  };
}

/*** Create an invalid authored-union value result. */
function invalidValue(path: readonly string[], message: string): UnionFailure {
  return {
    ok: false,
    diagnostic: { code: 'invalid-value', message, path },
  };
}
