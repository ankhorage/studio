import type { ThemeConfig } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import {
  createThemeModeUpdates,
  resolveActiveThemeModeSelection,
  resolveZoraSurfaceThemeConfig,
  resolveZoraThemeSourceModeConfig,
} from './adminThemeModel';

const theme = {
  id: 'theme-1',
  name: 'Theme',
  light: { primaryColor: '#111111', harmony: 'monochromatic' },
  dark: { primaryColor: '#222222', harmony: 'analogous' },
} satisfies ThemeConfig;

describe('adminThemeModel', () => {
  test('selects the active theme config for the actual surface mode', () => {
    const selection = resolveActiveThemeModeSelection({
      themes: [theme],
      activeThemeId: 'theme-1',
      surfaceMode: 'dark',
    });

    expect(selection?.mode).toBe('dark');
    expect(selection?.modeConfig).toEqual(theme.dark);
  });

  test('creates updates only for the active mode', () => {
    expect(createThemeModeUpdates('dark', { primaryColor: '#333333' })).toEqual({
      dark: { primaryColor: '#333333' },
    });
    expect(createThemeModeUpdates('light', { harmony: 'triadic' })).toEqual({
      light: { harmony: 'triadic' },
    });
  });

  test('uses matching mode config for generated Zora theme source values', () => {
    expect(resolveZoraThemeSourceModeConfig({ theme, mode: 'dark' })).toEqual(theme.dark);
    expect(resolveZoraThemeSourceModeConfig({ theme, mode: 'light' })).toEqual(theme.light);
  });

  test('live mode changes resolve the matching canonical source mode config', () => {
    const liveModes = ['light', 'dark'] as const;
    const resolved = liveModes.map((mode) => resolveZoraThemeSourceModeConfig({ theme, mode }));

    expect(resolved).toEqual([theme.light, theme.dark]);
  });

  test('creates a full Surface theme config from canonical light and dark values', () => {
    const surfaceConfig = resolveZoraSurfaceThemeConfig(theme);

    expect(surfaceConfig).toEqual(theme);
    expect(surfaceConfig.light).not.toBe(theme.light);
    expect(surfaceConfig.dark).not.toBe(theme.dark);
  });

  test('active theme ID selection falls back only when the active ID is missing', () => {
    const otherTheme = {
      ...theme,
      id: 'theme-2',
      name: 'Other Theme',
      light: { primaryColor: '#444444', harmony: 'triadic' },
    } satisfies ThemeConfig;

    expect(
      resolveActiveThemeModeSelection({
        themes: [theme, otherTheme],
        activeThemeId: 'theme-2',
        surfaceMode: 'light',
      })?.theme.id,
    ).toBe('theme-2');
    expect(
      resolveActiveThemeModeSelection({
        themes: [theme, otherTheme],
        activeThemeId: 'missing',
        surfaceMode: 'light',
      })?.theme.id,
    ).toBe('theme-1');
  });
});
