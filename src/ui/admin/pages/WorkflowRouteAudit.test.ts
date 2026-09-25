import { expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const directory = path.dirname(fileURLToPath(import.meta.url));

function readPage(name: string): string {
  return readFileSync(path.join(directory, name), 'utf8');
}

test('keeps overview as a read-only projection of canonical Studio state', () => {
  const source = readPage('OverviewAdminPage.tsx');

  expect(source).toContain('useStudio');
  expect(source).toContain('studio.manifest');
  expect(source).toContain('Metric');
  expect(source).not.toContain('TextInput');
  expect(source).not.toContain('JSON.parse');
  expect(source).not.toContain('JSON.stringify');
});

test('keeps screen and navigation management on canonical Contracts and typed workflow actions', () => {
  const source = readPage('ScreensAdminPage.tsx');

  expect(source).toContain('NAVIGATOR_TYPES');
  expect(source).toContain('deriveStudioScreenNavigationModel');
  expect(source).toContain('applyScreensAdminAction');
  expect(source).toContain('createStudioScreenRoutePath');
  expect(source).not.toContain('JSON.parse');
  expect(source).not.toContain('JSON.stringify');
});

test('keeps media import and removal on owner constants and guarded media lifecycle APIs', () => {
  const source = readPage('MediaAdminPage.tsx');

  expect(source).toContain('MEDIA_ASSET_KINDS');
  expect(source).toContain('createStudioUrlMediaAsset');
  expect(source).toContain('studio.upsertMediaAsset');
  expect(source).toContain('studio.deleteMediaAsset');
  expect(source).not.toContain("['image'");
  expect(source).not.toContain('JSON.parse');
  expect(source).not.toContain('JSON.stringify');
});

test('keeps module catalog and lifecycle on Orchestrator-backed operations', () => {
  const source = readPage('ModulesAdminPage.tsx');

  expect(source).toContain('listProjectModules');
  expect(source).toContain('installProjectModule');
  expect(source).toContain('uninstallProjectModule');
  expect(source).toContain('createStudioModuleRoutePath');
  expect(source).not.toContain('TextInput');
  expect(source).not.toContain('JSON.parse');
  expect(source).not.toContain('JSON.stringify');
});
