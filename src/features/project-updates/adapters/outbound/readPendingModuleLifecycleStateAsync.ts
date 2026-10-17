import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { isMissingPathError } from '@ankhorage/utility/node/fs';

import type { PendingModuleLifecycleReadResult } from '../../application/ports/outbound/PendingModuleLifecycleStatePort';
import { STUDIO_PENDING_MODULE_LIFECYCLE_FILE } from '../../constants';
import { parsePendingModuleLifecycleState } from '../../domain/pendingModuleLifecycleState';
import { digestProjectUpdateText } from '../../utils/digestProjectUpdateText';

/*** Read Studio pending lifecycle state with an immutable digest for plan/recovery preconditions. */
export async function readPendingModuleLifecycleStateAsync(
  rootPath: string,
): Promise<PendingModuleLifecycleReadResult> {
  const filePath = path.join(rootPath, STUDIO_PENDING_MODULE_LIFECYCLE_FILE);
  try {
    const content = await readFile(filePath, 'utf8');
    const digest = digestProjectUpdateText(content);
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
