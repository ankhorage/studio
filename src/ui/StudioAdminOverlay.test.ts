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

test('secret inventory clears rows and rejects stale environment responses', () => {
  expect(source).toContain('const generation = ++requestGeneration.current');
  expect(source).toContain('setItems([]);\n    setLoading(true);');
  expect(source).toContain('generation !== requestGeneration.current');
  expect(source).toContain('requestGeneration.current += 1');
});

test('secret usage lookup failures remain unavailable instead of becoming zero usages', () => {
  expect(source).toContain("status: 'error'");
  expect(source).toContain('Usage unavailable');
  expect(source).toContain('Reference status unavailable');
  expect(source).not.toContain('{ ref: item.ref, usages: [] }');
});
