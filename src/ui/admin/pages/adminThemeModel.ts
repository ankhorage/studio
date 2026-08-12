import type { AppManifest, ThemeConfig, ThemeModeConfig } from '@ankhorage/contracts';

type ActiveThemeMode = NonNullable<AppManifest['activeThemeMode']>;

export interface ActiveThemeModeSelection {
  readonly theme: ThemeConfig;
  readonly mode: ActiveThemeMode;
  readonly modeConfig: ThemeModeConfig;
}

export function resolveActiveThemeModeSelection(args: {
  readonly themes: readonly ThemeConfig[];
  readonly activeThemeId: string | undefined;
  readonly surfaceMode: ActiveThemeMode;
}): ActiveThemeModeSelection | null {
  const theme =
    args.themes.find((candidate) => candidate.id === args.activeThemeId) ?? args.themes[0] ?? null;
  if (!theme) return null;

  const modeConfig = theme[args.surfaceMode];

  return { theme, mode: args.surfaceMode, modeConfig };
}

export function createThemeModeUpdates(
  mode: ActiveThemeMode,
  updates: Partial<ThemeModeConfig>,
): { readonly light?: Partial<ThemeModeConfig>; readonly dark?: Partial<ThemeModeConfig> } {
  return mode === 'dark' ? { dark: updates } : { light: updates };
}

export function resolveZoraThemeSourceModeConfig(args: {
  readonly theme: ThemeConfig;
  readonly mode: ActiveThemeMode;
}): Pick<ThemeModeConfig, 'primaryColor' | 'harmony'> {
  return args.theme[args.mode];
}

export function resolveZoraSurfaceThemeConfig(theme: ThemeConfig): ThemeConfig {
  return {
    id: theme.id,
    name: theme.name,
    light: { ...theme.light },
    dark: { ...theme.dark },
  };
}
