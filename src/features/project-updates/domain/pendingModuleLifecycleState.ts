import { isRecord } from '@ankhorage/utility/object';

interface PendingModuleLifecycleOperation {
  readonly type: 'uninstall';
  readonly moduleId: string;
  readonly at: string;
}

export interface PendingModuleLifecycleState {
  readonly ops: readonly PendingModuleLifecycleOperation[];
}

export type PendingModuleLifecycleParseResult =
  { readonly valid: true; readonly value: PendingModuleLifecycleState } | { readonly valid: false };

/*** Parse Studio's persisted pending module lifecycle state without accepting ambiguous operations. */
export function parsePendingModuleLifecycleState(
  content: string,
): PendingModuleLifecycleParseResult {
  const value = parseJson(content);
  if (!isRecord(value) || !Array.isArray(value.ops)) return { valid: false };
  const ops = value.ops.map(parseOperation);
  if (ops.some((operation) => operation === undefined)) return { valid: false };
  const parsed = ops.filter(
    (operation): operation is PendingModuleLifecycleOperation => operation !== undefined,
  );
  const uniqueIds = new Set(parsed.map(({ moduleId }) => moduleId));
  return uniqueIds.size === parsed.length
    ? { valid: true, value: { ops: parsed } }
    : { valid: false };
}

/*** Serialize canonical Studio pending lifecycle state for one reviewed APM file change. */
export function serializePendingModuleLifecycleState(state: PendingModuleLifecycleState): string {
  return `${JSON.stringify(state, null, 2)}\n`;
}

/*** Return pending module ids in the persisted execution order. */
export function pendingModuleLifecycleIds(state: PendingModuleLifecycleState): readonly string[] {
  return state.ops.map(({ moduleId }) => moduleId);
}

/*** Remove only reviewed module ids while preserving unrelated pending operations. */
export function removeReviewedPendingModules(
  state: PendingModuleLifecycleState,
  moduleIds: ReadonlySet<string>,
): PendingModuleLifecycleState {
  return { ops: state.ops.filter(({ moduleId }) => !moduleIds.has(moduleId)) };
}

/*** Parse JSON into unknown data without leaking JSON.parse's any type. */
function parseJson(content: string): unknown {
  try {
    const value: unknown = JSON.parse(content);
    return value;
  } catch {
    return undefined;
  }
}

/*** Validate one persisted pending uninstall operation. */
function parseOperation(value: unknown): PendingModuleLifecycleOperation | undefined {
  if (!isRecord(value) || value.type !== 'uninstall') return undefined;
  if (typeof value.moduleId !== 'string' || value.moduleId.trim() === '') return undefined;
  if (typeof value.at !== 'string' || value.at.trim() === '') return undefined;
  return { type: 'uninstall', moduleId: value.moduleId.trim(), at: value.at };
}
