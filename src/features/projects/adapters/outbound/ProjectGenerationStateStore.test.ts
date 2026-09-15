import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, test } from 'bun:test';

import { ProjectGenerationStateStore } from './ProjectGenerationStateStore';

const store = new ProjectGenerationStateStore();

/*** Capture one asynchronous test failure as an Error value. */
async function captureErrorAsync(operation: () => Promise<unknown>): Promise<Error | null> {
  try {
    await operation();
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

test('persists explicit Studio inclusion without inventing runtime projection evidence', async () => {
  const projectPath = await mkdtemp(path.join(tmpdir(), 'ankhorage-studio-generation-state-'));

  await store.writeStudioInclusionAsync(projectPath, true);

  expect(await store.readStudioInclusionAsync(projectPath)).toBe(true);
  expect(
    JSON.parse(await readFile(path.join(projectPath, '.ankh/generation-state.json'), 'utf8')),
  ).toEqual({ includeStudio: true });
  expect(await store.readRuntimeProjectionStateAsync(projectPath, 'runtime-a')).toEqual({
    status: 'unknown',
    reason: 'missing-evidence',
  });
});

test('preserves runtime projection evidence when Studio inclusion changes', async () => {
  const projectPath = await mkdtemp(path.join(tmpdir(), 'ankhorage-studio-generation-state-'));
  await store.writeStudioInclusionAsync(projectPath, true);
  await store.recordRuntimeProjectionSuccessAsync(projectPath, 'runtime-a');

  await store.writeStudioInclusionAsync(projectPath, false);

  expect(await store.readStudioInclusionAsync(projectPath)).toBe(false);
  expect(await store.readRuntimeProjectionStateAsync(projectPath, 'runtime-a')).toEqual({
    status: 'current',
    reason: 'applied',
  });
});

test('reports persisted runtime drift as pending without a second pending ledger write', async () => {
  const projectPath = await mkdtemp(path.join(tmpdir(), 'ankhorage-studio-generation-state-'));
  await store.writeStudioInclusionAsync(projectPath, true);
  await store.recordRuntimeProjectionSuccessAsync(projectPath, 'runtime-a');

  expect(await store.readRuntimeProjectionStateAsync(projectPath, 'runtime-b')).toEqual({
    status: 'pending',
    reason: 'manifest-changed',
  });
});

test('keeps failed projection evidence visible until that runtime signature succeeds', async () => {
  const projectPath = await mkdtemp(path.join(tmpdir(), 'ankhorage-studio-generation-state-'));
  await store.writeStudioInclusionAsync(projectPath, true);
  await store.recordRuntimeProjectionSuccessAsync(projectPath, 'runtime-a');
  await store.recordRuntimeProjectionFailureAsync(projectPath, 'runtime-b');

  expect(await store.readRuntimeProjectionStateAsync(projectPath, 'runtime-b')).toEqual({
    status: 'failed',
    reason: 'projection-failed',
  });
  expect(await store.readRuntimeProjectionStateAsync(projectPath, 'runtime-c')).toEqual({
    status: 'pending',
    reason: 'manifest-changed',
  });

  await store.recordRuntimeProjectionSuccessAsync(projectPath, 'runtime-b');

  expect(await store.readRuntimeProjectionStateAsync(projectPath, 'runtime-b')).toEqual({
    status: 'current',
    reason: 'applied',
  });
});

test('requires explicit generation state instead of inferring Studio inclusion', async () => {
  const projectPath = await mkdtemp(path.join(tmpdir(), 'ankhorage-studio-generation-state-'));

  const error = await captureErrorAsync(() => store.readStudioInclusionAsync(projectPath));

  expect(error).not.toBeNull();
  expect(error?.message).toContain('Project generation state is missing');
});

test('rejects invalid runtime projection evidence', async () => {
  const projectPath = await mkdtemp(path.join(tmpdir(), 'ankhorage-studio-generation-state-'));
  const statePath = path.join(projectPath, '.ankh/generation-state.json');
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(
    statePath,
    JSON.stringify({ includeStudio: true, runtimeProjection: { appliedSignature: 1 } }),
    'utf8',
  );

  const error = await captureErrorAsync(() => store.readStudioInclusionAsync(projectPath));

  expect(error).not.toBeNull();
  expect(error?.message).toContain('Project generation state is invalid');
});
