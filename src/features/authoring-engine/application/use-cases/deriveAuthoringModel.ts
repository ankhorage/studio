import { isRecord } from '@ankhorage/utility/object';

import type {
  AuthoringDiagnostic,
  AuthoringNode,
  AuthoringPresentationPolicy,
  AuthoringPrimitive,
  AuthoringScalarType,
  AuthoringStructure,
} from '../../../../types/authoring-engine';

/*** Derive one UI-neutral authoring model from neutral structure semantics and a runtime value. */
export function deriveAuthoringModel(args: {
  readonly structure: AuthoringStructure;
  readonly value: unknown;
  readonly policy?: AuthoringPresentationPolicy;
  readonly label?: string;
}): AuthoringNode {
  return deriveNode({
    structure: args.structure,
    value: args.value,
    policy: args.policy,
    path: [],
    label: args.label ?? args.policy?.label ?? 'Value',
    optional: false,
    inheritedReadOnly: false,
  });
}

/*** Recursively derive one authoring node while retaining path, optionality, and inherited policy. */
function deriveNode(args: {
  readonly structure: AuthoringStructure;
  readonly value: unknown;
  readonly policy?: AuthoringPresentationPolicy;
  readonly path: readonly string[];
  readonly label: string;
  readonly optional: boolean;
  readonly inheritedReadOnly: boolean;
}): AuthoringNode {
  const readOnly = args.inheritedReadOnly || args.policy?.readOnly === true;
  const base = {
    path: args.path,
    label: args.policy?.label ?? args.label,
    ...(args.policy?.description ? { description: args.policy.description } : {}),
    optional: args.optional,
    readOnly,
    ...(args.policy?.editor ? { editor: args.policy.editor } : {}),
    ...(args.policy?.inheritance
      ? { inheritance: { ...args.policy.inheritance, overridden: args.value !== undefined } }
      : {}),
  };

  switch (args.structure.kind) {
    case 'scalar': {
      const value = readScalarValue(args.structure.scalarType, args.value, args.optional);
      return value.ok
        ? {
            ...base,
            kind: 'scalar',
            scalarType: args.structure.scalarType,
            value: value.value,
            multiline: args.policy?.multiline === true,
          }
        : unsupportedValue(base, value.diagnostic);
    }
    case 'choice': {
      const value = readChoiceValue(args.structure.values, args.value, args.optional);
      return value.ok
        ? {
            ...base,
            kind: 'choice',
            values: args.structure.values,
            value: value.value,
          }
        : unsupportedValue(base, value.diagnostic);
    }
    case 'set': {
      const value = readSetValue(args.structure.member, args.value, args.optional);
      return value.ok
        ? {
            ...base,
            kind: 'set',
            values: value.values,
            selected: value.selected,
          }
        : unsupportedValue(base, value.diagnostic);
    }
    case 'object': {
      if (args.value !== undefined && !isRecord(args.value)) {
        return unsupportedValue(base, {
          code: 'invalid-value',
          message: `Expected object value at ${formatPath(args.path)}.`,
          path: args.path,
        });
      }

      const record = isRecord(args.value) ? args.value : {};
      return {
        ...base,
        kind: 'object',
        fields: args.structure.fields.map((field) =>
          deriveNode({
            structure: field.structure,
            value: record[field.name],
            policy: args.policy?.fields?.[field.name],
            path: [...args.path, field.name],
            label: humanizeFieldName(field.name),
            optional: field.optional,
            inheritedReadOnly: readOnly,
          }),
        ),
      };
    }
    case 'unsupported':
      return unsupportedValue(base, args.structure.diagnostic);
  }
}

/*** Read and validate one scalar runtime value against its portable structural type. */
function readScalarValue(
  scalarType: AuthoringScalarType,
  value: unknown,
  optional: boolean,
): ScalarReadResult {
  if (value === undefined && optional) return { ok: true, value: undefined };
  if (isScalarTypeValue(scalarType, value)) {
    return { ok: true, value };
  }

  return {
    ok: false,
    diagnostic: {
      code: 'invalid-value',
      message: `Expected ${scalarType} authoring value.`,
      path: [],
    },
  };
}

/*** Decide whether one unknown runtime value satisfies a scalar descriptor type. */
function isScalarTypeValue(
  scalarType: AuthoringScalarType,
  value: unknown,
): value is AuthoringPrimitive {
  switch (scalarType) {
    case 'boolean':
      return typeof value === 'boolean';
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'null':
      return value === null;
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'string':
      return typeof value === 'string';
  }
}

/*** Read one finite-choice value without coercing values outside the descriptor options. */
function readChoiceValue(
  values: readonly AuthoringPrimitive[],
  value: unknown,
  optional: boolean,
): ScalarReadResult {
  if (value === undefined && optional) return { ok: true, value: undefined };
  if (values.some((candidate) => Object.is(candidate, value))) {
    return { ok: true, value: value as AuthoringPrimitive };
  }

  return {
    ok: false,
    diagnostic: {
      code: 'invalid-value',
      message: 'Authored value is not one of the finite descriptor choices.',
      path: [],
    },
  };
}

/*** Validate canonical unordered string membership against finite owner-provided choices. */
function readSetValue(
  member: AuthoringStructure,
  value: unknown,
  optional: boolean,
): SetReadResult {
  if (member.kind !== 'choice' || !member.values.every((candidate) => typeof candidate === 'string')) {
    return {
      ok: false,
      diagnostic: {
        code: 'unsupported-structure',
        message: 'Set authoring requires finite string member choices.',
        path: [],
      },
    };
  }

  const values = member.values as readonly string[];
  if (value === undefined && optional) return { ok: true, values, selected: [] };
  if (!isRecord(value)) {
    return {
      ok: false,
      diagnostic: {
        code: 'invalid-value',
        message: 'Expected serializable set membership object.',
        path: [],
      },
    };
  }

  const entries = Object.entries(value);
  const invalid = entries.find(([key, memberValue]) => memberValue !== true || !values.includes(key));
  if (invalid) {
    return {
      ok: false,
      diagnostic: {
        code: 'invalid-value',
        message: `Invalid set member "${invalid[0]}".`,
        path: [],
      },
    };
  }

  const selected = values.filter((candidate) => value[candidate] === true);
  return { ok: true, values, selected };
}

/*** Convert an invalid runtime value to an explicit unsupported authoring node. */
function unsupportedValue(
  base: {
    readonly path: readonly string[];
    readonly label: string;
    readonly description?: string;
    readonly optional: boolean;
    readonly readOnly: boolean;
  },
  diagnostic: AuthoringDiagnostic,
): AuthoringNode {
  return {
    ...base,
    kind: 'unsupported',
    diagnostic: {
      ...diagnostic,
      path: diagnostic.path.length > 0 ? diagnostic.path : base.path,
    },
  };
}

/*** Convert a source property name to a default human-readable field label. */
function humanizeFieldName(name: string): string {
  const spaced = name.replace(/([a-z0-9])([A-Z])/gu, '$1 $2').replaceAll(/[-_]+/gu, ' ');
  const firstCharacter = spaced.at(0);
  return firstCharacter ? firstCharacter.toUpperCase() + spaced.slice(1) : name;
}

/*** Format one authoring path for diagnostics without leaking implementation details. */
function formatPath(path: readonly string[]): string {
  return path.length === 0 ? 'root' : path.join('.');
}

type ScalarReadResult =
  | { readonly ok: true; readonly value: AuthoringPrimitive | undefined }
  | { readonly ok: false; readonly diagnostic: AuthoringDiagnostic };

type SetReadResult =
  | {
      readonly ok: true;
      readonly values: readonly string[];
      readonly selected: readonly string[];
    }
  | { readonly ok: false; readonly diagnostic: AuthoringDiagnostic };
