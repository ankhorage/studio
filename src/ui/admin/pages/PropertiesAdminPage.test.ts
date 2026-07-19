import { expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const source = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'PropertiesAdminPage.tsx'),
  'utf8',
);

test('resolves properties nodes across the manifest and activates the owning screen', () => {
  expect(source).toContain('findScreenIdForNode');
  expect(source).toContain('findNodeInManifest');
  expect(source).toContain('setActiveScreenId');
});
