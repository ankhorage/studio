import { expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const source = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'StudioProvider.ts'),
  'utf8',
);

test('uses canonical manifestState mutations for provider authoring state', () => {
  expect(source).toContain('updateStudioManifestDraftTheme');
  expect(source).toContain('updateStudioManifestDraftNode');
  expect(source).toContain('updateStudioManifestDraftAuthSettings');
  expect(source).not.toContain('updateNode: noop');
  expect(source).not.toContain('updateTheme: (_id: string, _updates: ThemeUpdates)');
});

test('owns Studio draft hydration and autosave through the host manifest boundary', () => {
  expect(source).toContain('/studio/manifest');
  expect(source).toContain('createStudioManifestSignature');
  expect(source).toContain('StudioManifestPersistenceCoordinator');
  expect(source).toContain('lastPersistedSignatureRef');
  expect(source).toContain('refetchManifest: persistence.refetchManifest');
  expect(source).toContain('flushManifest: persistence.flushManifest');
  expect(source).not.toContain('pendingSaveRef');
});

test('owns the stable Auth admin session for the Studio project lifetime', () => {
  expect(source).toContain('AuthAdminSessionProvider');
  expect(source).toContain('key: projectId');
  expect(source).toContain('projectId,');
  expect(source).toContain('React.createElement(StudioContext.Provider');
});
