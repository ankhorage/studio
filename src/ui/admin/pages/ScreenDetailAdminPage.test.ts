import { expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const source = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'ScreenDetailAdminPage.tsx'),
  'utf8',
);

test('renders detail from the canonical screen model without a second screen state', () => {
  expect(source).toContain('deriveStudioScreenNavigationModel');
  expect(source).toContain('resolveStudioScreenAppPath');
  expect(source).toContain('Screen not found');
  expect(source).toContain('routeReferences.map');
  expect(source).toContain('Canonical pathname/pattern');
  expect(source).toContain('Primary-navigation visibility');
  expect(source).not.toContain('useState');
  expect(source).not.toContain('route-key');
  expect(source).not.toContain('rename');
});
