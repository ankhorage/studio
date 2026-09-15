import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createNodeApplyLockPort } from '@ankhorage/apm/node';
import { expect, test } from 'bun:test';

import { runWithStudioProjectWriterLockAsync } from './runWithStudioProjectWriterLockAsync';

test('Studio writer blocks an independent APM apply lock on the same project root', async () => {
  const rootPath = await createProjectRootAsync();
  const entered = Promise.withResolvers<void>();
  const releaseStudio = Promise.withResolvers<void>();
  const apmLock = createNodeApplyLockPort();

  try {
    const studioWrite = runWithStudioProjectWriterLockAsync(rootPath, 'autosave', async () => {
      entered.resolve();
      await releaseStudio.promise;
    });
    await entered.promise;

    const competing = await apmLock.acquireAsync({
      rootPath,
      operationId: 'apm-apply',
      planId: 'apm-plan',
      resume: false,
    });
    expect(competing.state).toBe('conflict');
    expect(competing.lock.operationId).toStartWith('studio:autosave:');

    releaseStudio.resolve();
    await studioWrite;
  } finally {
    releaseStudio.resolve();
    await rm(rootPath, { recursive: true, force: true });
  }
});

test('APM apply lock blocks an independent Studio writer on the same project root', async () => {
  const rootPath = await createProjectRootAsync();
  const apmLock = createNodeApplyLockPort();

  try {
    const acquired = await apmLock.acquireAsync({
      rootPath,
      operationId: 'apm-apply',
      planId: 'apm-plan',
      resume: false,
    });
    expect(acquired.state).toBe('acquired');

    await expectRejectedMessageAsync(
      runWithStudioProjectWriterLockAsync(rootPath, 'module-install', () =>
        Promise.resolve(undefined),
      ),
      "blocked by APM operation 'apm-apply'",
    );
  } finally {
    await apmLock.releaseAsync(rootPath, 'apm-apply');
    await rm(rootPath, { recursive: true, force: true });
  }
});

test('nested Studio mutations are re-entrant only inside the owning async operation', async () => {
  const rootPath = await createProjectRootAsync();

  try {
    const result = await runWithStudioProjectWriterLockAsync(rootPath, 'module-save', () =>
      runWithStudioProjectWriterLockAsync(rootPath, 'project-save', () => Promise.resolve(42)),
    );
    expect(result).toBe(42);
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});

test('independent concurrent Studio mutations still contend on the project writer lock', async () => {
  const rootPath = await createProjectRootAsync();
  const entered = Promise.withResolvers<void>();
  const releaseFirst = Promise.withResolvers<void>();

  try {
    const firstWrite = runWithStudioProjectWriterLockAsync(rootPath, 'first-write', async () => {
      entered.resolve();
      await releaseFirst.promise;
    });
    await entered.promise;

    await expectRejectedMessageAsync(
      runWithStudioProjectWriterLockAsync(rootPath, 'second-write', () => Promise.resolve(undefined)),
      'Another operation owns the project writer lock.',
    );

    releaseFirst.resolve();
    await firstWrite;
  } finally {
    releaseFirst.resolve();
    await rm(rootPath, { recursive: true, force: true });
  }
});

/*** Create one isolated existing project root for writer-lock behavior tests. */
function createProjectRootAsync(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'studio-apm-writer-lock-'));
}

/*** Assert one project-writer operation rejects with the expected stable message fragment. */
async function expectRejectedMessageAsync(
  promise: Promise<unknown>,
  expectedMessage: string,
): Promise<void> {
  try {
    await promise;
    throw new Error(`Expected rejection containing '${expectedMessage}'.`);
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    if (!(error instanceof Error)) return;
    expect(error.message).toContain(expectedMessage);
  }
}
