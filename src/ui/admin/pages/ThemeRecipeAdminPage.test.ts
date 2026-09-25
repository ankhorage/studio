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

test('delegates recipe controls to the central authoring engine and retains theme persistence', () => {
  const page = readSibling('ThemeRecipeAdminPage.tsx');

  expect(page).toContain('resolveZoraThemeRecipeAuthoring(meta');
  expect(page).toContain('deriveAuthoringModel(');
  expect(page).toContain('<AuthoringEditor model={model} onMutation={updateRecipe} />');
  expect(page).toContain('applyAuthoringMutation(current, mutation)');
  expect(page).toContain('updateThemeRecipeOverrides(');
  expect(page).not.toContain("mutation.kind ===");
  expect(page).not.toContain('ThemeRecipeFieldEditor');
  expect(page).not.toContain('Object.entries(meta.fields).map');
});
