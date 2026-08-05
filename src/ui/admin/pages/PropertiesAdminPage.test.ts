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

test('consumes canonical ZORA metadata instead of dumping arbitrary node props', () => {
  expect(source).toContain('ZORA_COMPONENT_META');
  expect(source).toContain('resolveStudioInstancePropertyGroups');
  expect(source).toContain('createStudioInstancePropertyPatch');
  expect(source).not.toContain('Object.entries(node.props');
  expect(source).not.toContain('label="Alias"');
});

test('keeps theme-owned presentation out of instance controls', () => {
  expect(source).toContain('Visual design properties are theme-owned');
});
