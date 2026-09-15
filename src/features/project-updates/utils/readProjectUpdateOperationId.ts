import { isRecord } from '@ankhorage/utility/object';

/*** Read a durable APM operation id from one structured apply/resume result. */
export function readProjectUpdateOperationId(value: unknown): string | undefined {
  if (!isRecord(value) || value.operation !== 'apply') return undefined;
  return typeof value.operationId === 'string' && value.operationId.length > 0
    ? value.operationId
    : undefined;
}
