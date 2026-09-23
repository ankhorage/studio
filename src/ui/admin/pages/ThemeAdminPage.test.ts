import { expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

function readSibling(name: string): string {
  return readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), name), 'utf8');
}

test('uses the real ZORA mode authority without a second persisted editor mode', () => {
  const selector = readSibling('ThemeModeEditorSelector.tsx');
  const colorsPage = readSibling('ThemeColorsAdminPage.tsx');

  expect(selector).toContain('useZoraTheme()');
  expect(selector).toContain('setMode(candidate)');
  expect(selector).not.toContain('activeThemeMode');
  expect(colorsPage).toContain('deriveThemeAuthoringModel');
  expect(colorsPage).not.toContain('SUPPORTED_COLOR_HARMONIES');
});

test('keeps incomplete primary colors inside the custom owner-aware input', () => {
  const source = readSibling('ThemeColorsAdminPage.tsx');

  expect(source).toContain("editor?.kind !== 'theme-hex-color'");
  expect(source).toContain('defaultValue={typeof model.value');
  expect(source).toContain('parseHexColorOrThrow(primaryColor)');
  expect(source).not.toContain('createThemePrimaryColorDraft');
});

test('delegates global Theme fields and tokens to the central Authoring Engine', () => {
  const root = readSibling('ThemeAdminPage.tsx');
  const numeric = readSibling('ThemeNumericTokensAdminPage.tsx');
  const typography = readSibling('ThemeTypographyAdminPage.tsx');

  for (const source of [root, numeric, typography]) {
    expect(source).toContain('deriveThemeAuthoringModel');
    expect(source).toContain('<AuthoringEditor');
    expect(source).toContain('applyThemeAuthoringMutation');
  }
  expect(numeric).not.toContain('updateNumericThemeToken');
  expect(typography).not.toContain('ThemeTypographyHeadingEditor');
  expect(typography).not.toContain('ThemeTypographyWeightEditor');
});

test('keeps Theme root focused on canonical source and inheritance', () => {
  const source = readSibling('ThemeAdminPage.tsx');

  expect(source).toContain('Author the canonical project theme');
  expect(source).toContain('ThemeModeEditorSelector');
  expect(source).toContain('Theme changes do not rewrite');
});
