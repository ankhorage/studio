import type { ThemeModeConfig } from '@ankhorage/contracts';
import { expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { SUPPORTED_COLOR_HARMONIES } from './adminThemeHarmony';

function readSibling(name: string): string {
  return readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), name), 'utf8');
}

test('offers only supported typed ColorHarmony values', () => {
  const expected = [
    'monochromatic',
    'analogous',
    'complementary',
    'triadic',
    'tetradic',
    'splitComplementary',
  ] as const satisfies readonly ThemeModeConfig['harmony'][];

  expect(SUPPORTED_COLOR_HARMONIES).toEqual(expected);
});

test('uses the real ZORA mode authority without a second persisted editor mode', () => {
  const selector = readSibling('ThemeModeEditorSelector.tsx');
  const colorsPage = readSibling('ThemeColorsAdminPage.tsx');

  expect(selector).toContain('useZoraTheme()');
  expect(selector).toContain('setMode(candidate)');
  expect(selector).not.toContain('activeThemeMode');
  expect(colorsPage).not.toContain("harmony as ThemeModeConfig['harmony']");
  expect(colorsPage).not.toContain('as ThemeUpdates');
});

test('keeps Theme root focused on canonical source and inheritance', () => {
  const source = readSibling('ThemeAdminPage.tsx');

  expect(source).toContain('Author the canonical project theme');
  expect(source).toContain('ThemeModeEditorSelector');
  expect(source).toContain('Theme changes do not rewrite');
});
