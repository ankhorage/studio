import { createNodeApplyLockPort } from '@ankhorage/apm/node';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

const activeProjectRoots = new AsyncLocalStorage<ReadonlySet<string>>();
const projectWriterLock = createNodeApplyLockPort();

/*** Serialize one Studio project mutation through APM's canonical project writer lock. */
export async function runWithStudioProjectWriterLockAsync<T>(
  rootPath: string,
  operation: string,
  writeAsync: () => Promise<T>,
): Promise<T> {
  const normalizedRootPath = path.resolve(rootPath);
  const activeRoots = activeProjectRoots.getStore();
  if (activeRoots?.has(normalizedRootPath)) return writeAsync();

  const operationId = `studio:${operation}:${randomUUID()}`;
  const acquired = await projectWriterLock.acquireAsync({
    rootPath: normalizedRootPath,
    operationId,
    planId: `studio:${operation}`,
    resume: false,
  });
  if (acquired.state !== 'acquired') {
    throw new Error(
      `Studio project write '${operation}' is blocked by APM operation '${acquired.lock.operationId}': ${acquired.reason}`,
    );
  }

  const nextRoots = new Set([...(activeRoots ?? []), normalizedRootPath]);
  try {
    return await activeProjectRoots.run(nextRoots, writeAsync);
  } finally {
    await projectWriterLock.releaseAsync(normalizedRootPath, operationId);
  }
}
