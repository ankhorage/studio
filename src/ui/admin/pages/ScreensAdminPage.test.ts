import { expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const source = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'ScreensAdminPage.tsx'),
  'utf8',
);

test('uses the canonical screen/navigation model and ZORA overview controls', () => {
  expect(source).toContain('deriveStudioScreenNavigationModel');
  expect(source).toContain('applyScreensAdminAction');
  expect(source).toContain('ListSection');
  expect(source).toContain('ListRow');
  expect(source).toContain('ConfirmDialog');
  expect(source).toContain('SwitchField');
  expect(source).not.toContain('LayersPanel');
  expect(source).not.toContain('reorderScreens');
});
