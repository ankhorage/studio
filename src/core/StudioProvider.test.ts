import { expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const source = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'StudioProvider.ts'),
  'utf8',
);

test('uses canonical manifestState mutations for provider authoring state', () => {
  expect(source).toContain('updateStudioManifestTheme');
  expect(source).toContain('findScreenIdForNode');
  expect(source).toContain('updateStudioManifestNode');
  expect(source).not.toContain('updateNode: noop');
  expect(source).not.toContain('updateTheme: (_id: string, _updates: ThemeUpdates)');
});

test('owns Studio draft hydration and autosave through the host manifest boundary', () => {
  expect(source).toContain('/studio/manifest');
  expect(source).toContain('createStudioManifestSignature');
  expect(source).toContain('pendingSaveRef');
  expect(source).toContain('lastPersistedSignatureRef');
  expect(source).toContain('refetchManifest: persistence.refetchManifest');
});
