import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, test } from 'bun:test';

import { readProjectStudioInclusion, writeProjectStudioInclusion } from './projectGenerationState';

test('persists explicit Studio inclusion', async () => {
  const projectPath = await mkdtemp(path.join(tmpdir(), 'ankhorage-studio-generation-state-'));

  await writeProjectStudioInclusion(projectPath, true);

  expect(await readProjectStudioInclusion(projectPath)).toBe(true);
  expect(
    JSON.parse(await readFile(path.join(projectPath, '.ankh/generation-state.json'), 'utf8')),
  ).toEqual({ includeStudio: true });
});

test('persists an explicit Studio-free generated project', async () => {
  const projectPath = await mkdtemp(path.join(tmpdir(), 'ankhorage-studio-generation-state-'));

  await writeProjectStudioInclusion(projectPath, false);

  expect(await readProjectStudioInclusion(projectPath)).toBe(false);
});

test('requires explicit generation state instead of inferring Studio inclusion', async () => {
  const projectPath = await mkdtemp(path.join(tmpdir(), 'ankhorage-studio-generation-state-'));

  await expect(readProjectStudioInclusion(projectPath)).rejects.toThrow(
    'Project generation state is missing',
  );
});

test('rejects invalid generation state instead of inferring Studio inclusion', async () => {
  const projectPath = await mkdtemp(path.join(tmpdir(), 'ankhorage-studio-generation-state-'));
  const statePath = path.join(projectPath, '.ankh/generation-state.json');
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify({ includeStudio: 'yes' }), 'utf8');

  await expect(readProjectStudioInclusion(projectPath)).rejects.toThrow(
    'Project generation state is invalid',
  );
});
