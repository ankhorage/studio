import type { ThemeConfig } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import {
  resolveActiveThemeModeSelection,
  resolveZoraSurfaceThemeConfig,
} from './adminThemeModel';

const theme = {
  id: 'theme-1',
  name: 'Theme',
  light: { primaryColor: '#111111', harmony: 'monochromatic' },
  dark: { primaryColor: '#222222', harmony: 'analogous' },
  tokens: {
    spacing: { compact: 6 },
    radii: { card: 14 },
    typography: {
      sizes: { body: 16 },
      weights: { emphasis: '700' },
    },
    shadows: { raised: 8 },
  },
  recipes: {
    components: {
      Button: { size: 'l' },
    },
    patterns: {
      Panel: { padding: 'compact' },
    },
  },
} satisfies ThemeConfig;

describe('adminThemeModel', () => {
  test('selects the active theme config for the actual surface mode', () => {
    const selection = resolveActiveThemeModeSelection({
      themes: { 'theme-1': theme },
      activeThemeId: 'theme-1',
      surfaceMode: 'dark',
    });

    expect(selection?.mode).toBe('dark');
    expect(selection?.modeConfig).toEqual(theme.dark);
  });

  test('preserves the complete canonical theme config for live Surface sync', () => {
    const surfaceConfig = resolveZoraSurfaceThemeConfig(theme);

    expect(surfaceConfig).toEqual(theme);
    expect(surfaceConfig.tokens).toEqual(theme.tokens);
    expect(surfaceConfig.recipes).toEqual(theme.recipes);
    expect(surfaceConfig.light).not.toBe(theme.light);
    expect(surfaceConfig.dark).not.toBe(theme.dark);
  });

  test('active theme ID selection never invents a fallback theme', () => {
    const otherTheme = {
      ...theme,
      id: 'theme-2',
      name: 'Other Theme',
      light: { primaryColor: '#444444', harmony: 'triadic' },
    } satisfies ThemeConfig;

    expect(
      resolveActiveThemeModeSelection({
        themes: { 'theme-1': theme, 'theme-2': otherTheme },
        activeThemeId: 'theme-2',
        surfaceMode: 'light',
      })?.theme.id,
    ).toBe('theme-2');
    expect(
      resolveActiveThemeModeSelection({
        themes: { 'theme-1': theme, 'theme-2': otherTheme },
        activeThemeId: 'missing',
        surfaceMode: 'light',
      })?.theme.id,
    ).toBeUndefined();
  });
});
