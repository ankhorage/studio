import { isRecord } from '@ankhorage/utility/object';

import type {
  AuthoringDiagnostic,
  AuthoringNode,
  AuthoringOrderedListItem,
  AuthoringPresentationPolicy,
  AuthoringPrimitive,
  AuthoringScalarType,
  AuthoringStructure,
  AuthoringValueMapKey,
} from '../../../../types/authoring-engine';

/*** Derive one UI-neutral authoring model from neutral structure semantics and a runtime value. */
export function deriveAuthoringModel(args: {
  readonly structure: AuthoringStructure;
  readonly value: unknown;
  readonly policy?: AuthoringPresentationPolicy;
  readonly label?: string;
  readonly path?: readonly string[];
  readonly optional?: boolean;
}): AuthoringNode {
  return deriveNode({
    structure: args.structure,
    value: args.value,
    policy: args.policy,
    path: args.path ?? [],
    label: args.label ?? args.policy?.label ?? 'Value',
    optional: args.optional ?? false,
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
    case 'ordered-list': {
      const value = readOrderedListValue(args.structure.item, args.value, args.optional);
      return value.ok
        ? {
            ...base,
            kind: 'ordered-list',
            item: value.item,
            items: value.items,
          }
        : unsupportedValue(base, value.diagnostic);
    }
    case 'value-map': {
      const valueStructure = args.structure.value;
      const value = readValueMapValue(args.structure.key, args.value, args.optional);
      return value.ok
        ? {
            ...base,
            kind: 'value-map',
            key: value.key,
            valueStructure,
            entries: mergeValueMapEntries(value.entries, args.policy?.fields, value.key).map(
              ([key, entryValue, authored]) => {
                const entryPolicy = resolvePresentationFieldPolicy(args.policy?.fields, key);
                return {
                  key,
                  authored,
                  value: deriveNode({
                    structure: valueStructure,
                    value: entryValue,
                    policy: entryPolicy,
                    path: [...args.path, key],
                    label: 'Value',
                    optional: entryPolicy?.inheritance !== undefined,
                    inheritedReadOnly: readOnly,
                  }),
                };
              },
            ),
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

/*** Resolve one presentation field policy without arbitrary dynamic object indexing. */
function resolvePresentationFieldPolicy(
  fields: Readonly<Record<string, AuthoringPresentationPolicy>> | undefined,
  key: string,
): AuthoringPresentationPolicy | undefined {
  return Object.entries(fields ?? {}).find(([fieldName]) => fieldName === key)?.[1];
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
  if (
    member.kind !== 'choice' ||
    !member.values.every((candidate) => typeof candidate === 'string')
  ) {
    return {
      ok: false,
      diagnostic: {
        code: 'unsupported-structure',
        message: 'Set authoring requires finite string member choices.',
        path: [],
      },
    };
  }

  const { values } = member;
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
  const invalid = entries.find(
    ([key, memberValue]) => memberValue !== true || !values.includes(key),
  );
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

  const selectedKeys = new Set(entries.map(([key]) => key));
  const selected = values.filter((candidate) => selectedKeys.has(candidate));
  return { ok: true, values, selected };
}

/*** Validate keyed value-map state while keeping key identity distinct from collection order. */
function readValueMapValue(
  keyStructure: AuthoringStructure,
  value: unknown,
  optional: boolean,
): ValueMapReadResult {
  const key = resolveValueMapKey(keyStructure);
  if (!key.ok) return key;

  if (value === undefined && optional) return { ok: true, key: key.key, entries: [] };
  if (!isRecord(value)) {
    return {
      ok: false,
      diagnostic: {
        code: 'invalid-value',
        message: 'Expected value-map object.',
        path: [],
      },
    };
  }

  const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
  const invalid = entries.find(([candidate]) => !isValueMapKeyAllowed(key.key, candidate));
  if (invalid) {
    return {
      ok: false,
      diagnostic: {
        code: 'invalid-value',
        message: `Invalid value-map key "${invalid[0]}".`,
        path: [],
      },
    };
  }

  return { ok: true, key: key.key, entries };
}

/*** Merge authored entries with presentation-only inherited keys without materializing defaults. */
function mergeValueMapEntries(
  authoredEntries: readonly (readonly [string, unknown])[],
  fields: Readonly<Record<string, AuthoringPresentationPolicy>> | undefined,
  key: AuthoringValueMapKey,
): readonly (readonly [string, unknown, boolean])[] {
  const authoredKeys = new Set(authoredEntries.map(([entryKey]) => entryKey));
  const inheritedKeys = Object.keys(fields ?? {}).filter(
    (candidate) => !authoredKeys.has(candidate) && isValueMapKeyAllowed(key, candidate),
  );
  return [
    ...authoredEntries.map(([entryKey, value]) => [entryKey, value, true] as const),
    ...inheritedKeys.map((entryKey) => [entryKey, undefined, false] as const),
  ].sort(([left], [right]) => left.localeCompare(right));
}

/*** Resolve the currently supported portable value-map key semantics. */
function resolveValueMapKey(structure: AuthoringStructure): ValueMapKeyResult {
  if (structure.kind === 'scalar' && structure.scalarType === 'string') {
    return { ok: true, key: { kind: 'scalar', scalarType: 'string' } };
  }
  if (structure.kind === 'choice') {
    const values = structure.values.filter(
      (candidate): candidate is string => typeof candidate === 'string',
    );
    if (values.length === structure.values.length) {
      return { ok: true, key: { kind: 'choice', values } };
    }
  }
  return {
    ok: false,
    diagnostic: {
      code: 'unsupported-structure',
      message: 'Value-map authoring requires scalar-string or finite-string-choice keys.',
      path: [],
    },
  };
}

/*** Check one authored object key against the resolved value-map key contract. */
function isValueMapKeyAllowed(key: AuthoringValueMapKey, candidate: string): boolean {
  return key.kind === 'scalar' || key.values.includes(candidate);
}

/*** Validate one ordered primitive list while preserving authored order and duplicates. */
function readOrderedListValue(
  item: AuthoringStructure,
  value: unknown,
  optional: boolean,
): OrderedListReadResult {
  if (item.kind === 'choice') {
    if (value === undefined && optional) {
      return { ok: true, item: { kind: 'choice', values: item.values }, items: [] };
    }
    if (!Array.isArray(value)) {
      return orderedListInvalidValue('Expected ordered-list array value.');
    }

    const hasInvalidItem = value.some(
      (candidate) => !item.values.some((allowed) => Object.is(allowed, candidate)),
    );
    if (hasInvalidItem) {
      return orderedListInvalidValue(
        'Ordered-list item is not one of the finite descriptor choices.',
      );
    }

    return {
      ok: true,
      item: { kind: 'choice', values: item.values },
      items: value as readonly AuthoringPrimitive[],
    };
  }

  if (item.kind === 'scalar' && item.scalarType === 'string') {
    if (value === undefined && optional) {
      return { ok: true, item: { kind: 'scalar', scalarType: 'string' }, items: [] };
    }
    if (!Array.isArray(value)) {
      return orderedListInvalidValue('Expected ordered-list array value.');
    }
    if (!value.every((candidate) => typeof candidate === 'string')) {
      return orderedListInvalidValue('Ordered-list item must be a string.');
    }

    return {
      ok: true,
      item: { kind: 'scalar', scalarType: 'string' },
      items: value,
    };
  }

  return {
    ok: false,
    diagnostic: {
      code: 'unsupported-structure',
      message: 'Ordered-list authoring supports finite primitive choices or scalar string items.',
      path: [],
    },
  };
}

/*** Create an invalid-value result for malformed ordered-list runtime data. */
function orderedListInvalidValue(message: string): OrderedListReadResult {
  return {
    ok: false,
    diagnostic: {
      code: 'invalid-value',
      message,
      path: [],
    },
  };
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

type OrderedListReadResult =
  | {
      readonly ok: true;
      readonly item: AuthoringOrderedListItem;
      readonly items: readonly AuthoringPrimitive[];
    }
  | { readonly ok: false; readonly diagnostic: AuthoringDiagnostic };

type ValueMapKeyResult =
  | { readonly ok: true; readonly key: AuthoringValueMapKey }
  | { readonly ok: false; readonly diagnostic: AuthoringDiagnostic };

type ValueMapReadResult =
  | {
      readonly ok: true;
      readonly key: AuthoringValueMapKey;
      readonly entries: readonly (readonly [string, unknown])[];
    }
  | { readonly ok: false; readonly diagnostic: AuthoringDiagnostic };
