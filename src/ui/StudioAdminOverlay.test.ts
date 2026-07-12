import { expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const source = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'StudioAdminOverlay.tsx'),
  'utf8',
);

test('secret inventory exposes an environment filter', () => {
  expect(source).toContain('Environment filter');
  expect(source).toContain('useSecretInventory(projectId, inventoryEnvironment)');
});

test('secret inventory clears rows when the selected environment fails to load', () => {
  expect(source).toContain('setItems([])');
  expect(source).toContain('setError(toMessage(caught))');
});

test('secret usage lookup failures remain unavailable instead of becoming zero usages', () => {
  expect(source).toContain("status: 'error'");
  expect(source).toContain('Usage unavailable');
  expect(source).toContain('Reference status unavailable');
  expect(source).not.toContain('{ ref: item.ref, usages: [] }');
});
