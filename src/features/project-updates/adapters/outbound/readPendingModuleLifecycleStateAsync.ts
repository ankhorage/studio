import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { isMissingPathError } from '@ankhorage/utility/node/fs';

import { STUDIO_PENDING_MODULE_LIFECYCLE_FILE } from '../../constants';
import {
  parsePendingModuleLifecycleState,
  type PendingModuleLifecycleState,
} from '../../domain/pendingModuleLifecycleState';

export type PendingModuleLifecycleReadResult =
  | { readonly state: 'absent' }
  | {
      readonly state: 'valid';
      readonly value: PendingModuleLifecycleState;
      readonly content: string;
      readonly digest: string;
    }
  | { readonly state: 'invalid'; readonly content: string; readonly digest: string }
  | { readonly state: 'unreadable'; readonly reason: string };

/*** Read Studio pending lifecycle state with an immutable digest for plan/recovery preconditions. */
export async function readPendingModuleLifecycleStateAsync(
  rootPath: string,
): Promise<PendingModuleLifecycleReadResult> {
  const filePath = path.join(rootPath, STUDIO_PENDING_MODULE_LIFECYCLE_FILE);
  try {
    const content = await readFile(filePath, 'utf8');
    const digest = digestText(content);
    const parsed = parsePendingModuleLifecycleState(content);
    return parsed.valid
      ? { state: 'valid', value: parsed.value, content, digest }
      : { state: 'invalid', content, digest };
  } catch (error: unknown) {
    if (isMissingPathError(error)) return { state: 'absent' };
    return {
      state: 'unreadable',
      reason: error instanceof Error ? error.message : 'unknown pending-state read failure',
    };
  }
}

/*** Compute the canonical SHA-256 digest used by APM reviewed text changes. */
export function digestProjectUpdateText(content: string): string {
  return digestText(content);
}

/*** Hash one reviewed text value without environment-dependent encoding. */
function digestText(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}
