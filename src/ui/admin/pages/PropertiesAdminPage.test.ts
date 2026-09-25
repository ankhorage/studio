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

test('derives instance Properties from injected owner metadata through the central engine', () => {
  expect(source).toContain('studio.bindableComponentMeta');
  expect(source).toContain('resolveInstancePropertyAuthoring');
  expect(source).toContain('deriveAuthoringModel');
  expect(source).toContain('<AuthoringEditor');
  expect(source).toContain('applyAuthoringMutation(node.props ?? {}, mutation)');
  expect(source).toContain('studio.updateNode(node.id, { props: result.value })');
  expect(source).not.toContain('createStudioInstancePropertyPatch');
  expect(source).not.toContain("mutation.kind ===");
  expect(source).not.toContain('resolveStudioInstancePropertyGroups');
  expect(source).not.toContain('InstancePropertyEditor');
  expect(source).not.toContain('ZORA_COMPONENT_META');
});

test('keeps media as an explicit authoring editor extension without bespoke generic controls', () => {
  expect(source).toContain('renderCustomControl');
  expect(source).toContain('<MediaPropertyInput');
  expect(source).not.toContain('Pressable');
  expect(source).not.toContain('#4f46e5');
});

test('keeps node alias as read-only identity instead of an authorable property', () => {
  expect(source).toContain('<KeyValue label="Alias"');
  expect(source).not.toContain('<Field label="Alias"');
});

test('keeps theme-owned presentation out of instance controls', () => {
  expect(source).toContain('Visual design properties are theme-owned');
});
