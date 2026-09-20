import { isRecord } from '@ankhorage/utility/object';

import type {
  AuthoringMutation,
  AuthoringMutationResult,
} from '../../../../types/authoring-engine';

/*** Apply one path-safe immutable authoring mutation without guessing through missing/non-object state. */
export function applyAuthoringMutation<T>(
  current: T,
  mutation: AuthoringMutation,
): AuthoringMutationResult<T> {
  if (mutation.path.length === 0 || !isRecord(current)) {
    return rejectedMutation(mutation, 'Authoring mutations require one non-empty object path.');
  }

  const updated = updateRecordAtPath(current, mutation.path, mutation);
  return updated.ok ? { ok: true, value: updated.value as T } : updated;
}

/*** Recursively update a JSON object by rebuilding entries instead of injecting arbitrary keys. */
function updateRecordAtPath(
  current: Readonly<Record<string, unknown>>,
  path: readonly string[],
  mutation: AuthoringMutation,
): RecordUpdateResult {
  const [segment, ...remaining] = path;
  if (!segment) return rejectedMutation(mutation, 'Authoring mutation path is empty.');

  if (remaining.length === 0) {
    return {
      ok: true,
      value:
        mutation.kind === 'unset'
          ? Object.fromEntries(Object.entries(current).filter(([key]) => key !== segment))
          : replaceRecordEntry(current, segment, mutation.value),
    };
  }

  const entry = Object.entries(current).find(([key]) => key === segment);
  if (!entry || !isRecord(entry[1])) {
    return rejectedMutation(
      mutation,
      `Cannot traverse non-object authoring path segment "${segment}".`,
    );
  }

  const nested = updateRecordAtPath(entry[1], remaining, mutation);
  if (!nested.ok) return nested;
  return { ok: true, value: replaceRecordEntry(current, segment, nested.value) };
}

/*** Replace or append one record entry while retaining deterministic existing key order. */
function replaceRecordEntry(
  current: Readonly<Record<string, unknown>>,
  key: string,
  value: unknown,
): Record<string, unknown> {
  const entries = Object.entries(current);
  const exists = entries.some(([entryKey]) => entryKey === key);
  const replaced = entries.map(([entryKey, entryValue]) =>
    entryKey === key ? ([entryKey, value] as const) : ([entryKey, entryValue] as const),
  );
  return Object.fromEntries(exists ? replaced : [...replaced, [key, value]]);
}

/*** Return one explicit mutation rejection at the requested authoring path. */
function rejectedMutation(
  mutation: AuthoringMutation,
  message: string,
): AuthoringMutationRejection {
  return {
    ok: false,
    diagnostic: {
      code: 'mutation-rejected',
      message,
      path: mutation.path,
    },
  };
}

type RecordUpdateResult =
  { readonly ok: true; readonly value: Record<string, unknown> } | AuthoringMutationRejection;

interface AuthoringMutationRejection {
  readonly ok: false;
  readonly diagnostic: {
    readonly code: 'mutation-rejected';
    readonly message: string;
    readonly path: readonly string[];
  };
}
