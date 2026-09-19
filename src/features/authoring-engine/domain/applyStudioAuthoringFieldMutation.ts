import { deleteOwnProperty, isRecord, readOwnProperty, setOwnProperty } from '@ankhorage/utility/object';

import type {
  StudioAuthoringDiagnostic,
  StudioAuthoringField,
  StudioAuthoringMutationResult,
} from './authoringTypes';

/*** Apply one validated authoring-field mutation immutably while preserving undeclared sibling state. */
export function applyStudioAuthoringFieldMutation<TValue>(
  value: TValue,
  field: StudioAuthoringField,
  nextValue: unknown,
): StudioAuthoringMutationResult<TValue> {
  const diagnostic = validateMutation(field, nextValue);
  if (diagnostic) return { ok: false, diagnostic };
  if (field.path.length === 0 || !isRecord(value)) {
    return {
      ok: false,
      diagnostic: {
        code: 'invalid-value',
        path: field.path,
        message: 'Authoring mutations require a non-root field on an object value.',
      },
    };
  }

  const written = writeObjectPath(value, field.path, nextValue);
  if (!written.ok) return written;
  return { ok: true, value: written.value as TValue };
}

/*** Validate a proposed value against the neutral field semantics before touching authored state. */
function validateMutation(
  field: StudioAuthoringField,
  nextValue: unknown,
): StudioAuthoringDiagnostic | null {
  if (field.readOnly) return diagnostic(field, 'read-only', 'This field is read-only.');
  if (nextValue === undefined) {
    return field.optional
      ? null
      : diagnostic(field, 'required-value', 'This field is required and cannot be removed.');
  }

  if (field.kind === 'text' && typeof nextValue !== 'string') {
    return diagnostic(field, 'invalid-value', 'Expected a string value.');
  }
  if (
    field.kind === 'number' &&
    (typeof nextValue !== 'number' || !Number.isFinite(nextValue))
  ) {
    return diagnostic(field, 'invalid-value', 'Expected one finite number.');
  }
  if (field.kind === 'boolean' && typeof nextValue !== 'boolean') {
    return diagnostic(field, 'invalid-value', 'Expected a boolean value.');
  }
  if (
    field.kind === 'choice' &&
    !field.options.some((option) => Object.is(option, nextValue))
  ) {
    return diagnostic(field, 'invalid-value', 'Value is not one of the canonical choices.');
  }
  return null;
}

type PathWriteResult =
  | { readonly ok: true; readonly value: Readonly<Record<string, unknown>> }
  | { readonly ok: false; readonly diagnostic: StudioAuthoringDiagnostic };

/*** Recursively clone only the authored object path and set or remove the terminal property. */
function writeObjectPath(
  current: Readonly<Record<string, unknown>>,
  path: readonly string[],
  nextValue: unknown,
): PathWriteResult {
  const [key, ...rest] = path;
  if (!key) {
    return {
      ok: false,
      diagnostic: {
        code: 'invalid-value',
        path,
        message: 'Authoring mutation path is empty.',
      },
    };
  }

  const clone: Record<string, unknown> = { ...current };
  if (rest.length === 0) {
    if (nextValue === undefined) deleteOwnProperty(clone, key);
    else setOwnProperty(clone, key, nextValue);
    return { ok: true, value: clone };
  }

  const child = readOwnProperty(current, key);
  if (!isRecord(child)) {
    return {
      ok: false,
      diagnostic: {
        code: 'invalid-value',
        path,
        message: `Cannot traverse non-object authoring path segment "${key}".`,
      },
    };
  }

  const nested = writeObjectPath(child, rest, nextValue);
  if (!nested.ok) return nested;
  setOwnProperty(clone, key, nested.value);
  return { ok: true, value: clone };
}

/*** Create one field-scoped authoring mutation diagnostic. */
function diagnostic(
  field: StudioAuthoringField,
  code: StudioAuthoringDiagnostic['code'],
  message: string,
): StudioAuthoringDiagnostic {
  return { code, path: [...field.path], message };
}
