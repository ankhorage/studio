import type { ThemeConfig, ThemeModeConfig } from '@ankhorage/contracts';

import type { StudioMode } from '../../../index';

export interface ActiveThemeModeSelection {
  readonly theme: ThemeConfig;
  readonly mode: StudioMode;
  readonly modeConfig: ThemeModeConfig;
}

export function resolveActiveThemeModeSelection(args: {
  readonly themes: readonly ThemeConfig[];
  readonly activeThemeId: string | undefined;
  readonly surfaceMode: StudioMode;
}): ActiveThemeModeSelection | null {
  const theme =
    args.themes.find((candidate) => candidate.id === args.activeThemeId) ?? args.themes[0] ?? null;
  if (!theme) return null;

  const modeConfig = theme[args.surfaceMode];

  return { theme, mode: args.surfaceMode, modeConfig };
}

export function createThemeModeUpdates(
  mode: StudioMode,
  updates: Partial<ThemeModeConfig>,
): { readonly light?: Partial<ThemeModeConfig>; readonly dark?: Partial<ThemeModeConfig> } {
  return mode === 'dark' ? { dark: updates } : { light: updates };
}

export function resolveZoraThemeSourceModeConfig(args: {
  readonly theme: ThemeConfig;
  readonly mode: StudioMode;
}): Pick<ThemeModeConfig, 'primaryColor' | 'harmony'> {
  return args.theme[args.mode];
}
