import type { ThemeModeConfig } from '@ankhorage/contracts';
import { expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { SUPPORTED_COLOR_HARMONIES } from './adminThemeHarmony';

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

test('does not accept arbitrary harmony text through type assertions', () => {
  const source = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'ThemeAdminPage.tsx'),
    'utf8',
  );

  expect(source).not.toContain("harmony as ThemeModeConfig['harmony']");
  expect(source).not.toContain('as ThemeUpdates');
});
