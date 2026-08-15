import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, test } from 'bun:test';

import { readProjectStudioInclusion, writeProjectStudioInclusion } from './projectGenerationState';

test('persists explicit Studio inclusion independently from legacy source directories', async () => {
  const projectPath = await mkdtemp(path.join(tmpdir(), 'ankhorage-studio-generation-state-'));

  await writeProjectStudioInclusion(projectPath, true);

  expect(await readProjectStudioInclusion(projectPath)).toBe(true);
  expect(
    JSON.parse(await readFile(path.join(projectPath, '.ankh/generation-state.json'), 'utf8')),
  ).toEqual({ schemaVersion: 1, includeStudio: true });
});

test('preserves an explicit Studio-free generated project', async () => {
  const projectPath = await mkdtemp(path.join(tmpdir(), 'ankhorage-studio-generation-state-'));

  await writeProjectStudioInclusion(projectPath, false);

  expect(await readProjectStudioInclusion(projectPath)).toBe(false);
});

test('migrates a legacy generated admin route to persisted Studio inclusion', async () => {
  const projectPath = await mkdtemp(path.join(tmpdir(), 'ankhorage-studio-generation-state-'));
  const adminLayoutPath = path.join(projectPath, 'src/app/ankh/_layout.tsx');
  await mkdir(path.dirname(adminLayoutPath), { recursive: true });
  await writeFile(adminLayoutPath, 'export default function Layout() { return null; }\n');

  expect(await readProjectStudioInclusion(projectPath)).toBe(true);
  expect(
    JSON.parse(await readFile(path.join(projectPath, '.ankh/generation-state.json'), 'utf8')),
  ).toEqual({ schemaVersion: 1, includeStudio: true });
});

test('migrates legacy Studio-only scaffold dependencies when admin routes are unavailable', async () => {
  const projectPath = await mkdtemp(path.join(tmpdir(), 'ankhorage-studio-generation-state-'));
  await writeFile(
    path.join(projectPath, 'package.json'),
    JSON.stringify({ dependencies: { 'expo-document-picker': '~14.0.8' } }),
  );

  expect(await readProjectStudioInclusion(projectPath)).toBe(true);
});
