import { expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

function readSibling(name: string): string {
  return readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), name), 'utf8');
}

test('consumes the canonical ZORA recipe registry at the UI boundary', () => {
  const page = readSibling('ThemeRecipeAdminPage.tsx');
  const catalog = readSibling('ThemeRecipeCatalog.tsx');

  expect(page).toContain('ZORA_THEME_RECIPE_META');
  expect(catalog).toContain('ZORA_THEME_RECIPE_META');
  expect(page).not.toContain("recipeName === 'Button'");
  expect(page).not.toContain("recipeName === 'Card'");
  expect(page).not.toContain("recipeName === 'Panel'");
});

test('renders controls from metadata field kinds and supports inherited reset', () => {
  const field = readSibling('ThemeRecipeFieldEditor.tsx');

  expect(field).toContain("meta.type === 'boolean'");
  expect(field).toContain("meta.type === 'choice'");
  expect(field).toContain('tokenOptions');
  expect(field).toContain('onChange(undefined)');
});
