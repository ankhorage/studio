import type { ThemeConfig } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import {
  createThemeModeUpdates,
  resolveActiveThemeModeSelection,
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
});
