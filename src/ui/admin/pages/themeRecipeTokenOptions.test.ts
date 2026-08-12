import { describe, expect, test } from 'bun:test';

import { resolveThemeRecipeTokenOptions } from './themeRecipeTokenOptions';

const theme = {
  colors: { primary: '#000', surface: '#fff' },
  spacing: { none: 0, m: 16, custom: 20 },
  radii: { none: 0, l: 16 },
  shadows: { soft: 2 },
  typography: {
    sizes: { body: 16 },
    weights: { bold: '700' },
    headings: { '1': { size: 40 } },
  },
};

describe('themeRecipeTokenOptions', () => {
  test('reads exact runtime token keys for scalar families', () => {
    expect(resolveThemeRecipeTokenOptions(theme, 'spacing')).toEqual(['custom', 'm', 'none']);
    expect(resolveThemeRecipeTokenOptions(theme, 'radii')).toEqual(['l', 'none']);
    expect(resolveThemeRecipeTokenOptions(theme, 'colors')).toEqual(['primary', 'surface']);
    expect(resolveThemeRecipeTokenOptions(theme, 'shadows')).toEqual(['soft']);
  });

  test('matches ZORA typography token validation across all typography slots', () => {
    expect(resolveThemeRecipeTokenOptions(theme, 'typography')).toEqual(['1', 'body', 'bold']);
  });
});
