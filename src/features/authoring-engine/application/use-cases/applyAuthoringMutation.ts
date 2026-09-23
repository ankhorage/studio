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
  if (!isRecord(current)) {
    return rejectedMutation(mutation, 'Authoring mutations require object state.');
  }

  if (mutation.kind === 'rename-key') {
    const updated = renameRecordKeyAtPath(current, mutation.path, mutation);
    return updated.ok ? { ok: true, value: updated.value as T } : updated;
  }

  if (mutation.path.length === 0) {
    return rejectedMutation(
      mutation,
      'Authoring value mutations require one non-empty object path.',
    );
  }

  const updated = updateRecordAtPath(current, mutation.path, mutation);
  return updated.ok ? { ok: true, value: updated.value as T } : updated;
}

/*** Recursively update a JSON object by rebuilding entries instead of injecting arbitrary keys. */
function updateRecordAtPath(
  current: Readonly<Record<string, unknown>>,
  path: readonly string[],
  mutation: AuthoringValueMutation,
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

/*** Rename one keyed entry atomically while rejecting missing sources and duplicate targets. */
function renameRecordKeyAtPath(
  current: Readonly<Record<string, unknown>>,
  path: readonly string[],
  mutation: AuthoringRenameKeyMutation,
): RecordUpdateResult {
  if (path.length === 0) return renameRecordKey(current, mutation);

  const [segment, ...remaining] = path;
  if (!segment) return rejectedMutation(mutation, 'Authoring rename path is empty.');
  const entry = Object.entries(current).find(([key]) => key === segment);
  if (!entry || !isRecord(entry[1])) {
    return rejectedMutation(
      mutation,
      `Cannot traverse non-object authoring path segment "${segment}".`,
    );
  }

  const nested = renameRecordKeyAtPath(entry[1], remaining, mutation);
  if (!nested.ok) return nested;
  return { ok: true, value: replaceRecordEntry(current, segment, nested.value) };
}

/*** Rename one record key without changing the associated value or surrounding entries. */
function renameRecordKey(
  current: Readonly<Record<string, unknown>>,
  mutation: AuthoringRenameKeyMutation,
): RecordUpdateResult {
  if (mutation.fromKey === mutation.toKey) return { ok: true, value: { ...current } };
  const entries = Object.entries(current);
  if (!entries.some(([key]) => key === mutation.fromKey)) {
    return rejectedMutation(mutation, `Value-map key "${mutation.fromKey}" does not exist.`);
  }
  if (entries.some(([key]) => key === mutation.toKey)) {
    return rejectedMutation(mutation, `Value-map key "${mutation.toKey}" already exists.`);
  }

  return {
    ok: true,
    value: Object.fromEntries(
      entries.map(([key, value]) =>
        key === mutation.fromKey ? ([mutation.toKey, value] as const) : ([key, value] as const),
      ),
    ),
  };
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

type AuthoringRenameKeyMutation = Extract<AuthoringMutation, { readonly kind: 'rename-key' }>;
type AuthoringValueMutation = Exclude<AuthoringMutation, AuthoringRenameKeyMutation>;
