import type { AppManifest, ThemeConfig, ThemeModeConfig } from '@ankhorage/contracts';

type ActiveThemeMode = NonNullable<AppManifest['activeThemeMode']>;

export interface ActiveThemeModeSelection {
  readonly theme: ThemeConfig;
  readonly mode: ActiveThemeMode;
  readonly modeConfig: ThemeModeConfig;
}

/***
 * Resolve the active theme by configured id with first-theme fallback, then select the requested light/dark mode config.
 * @todo Move active-theme selection policy from admin UI into the theme domain/application model.
 */
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

/*** Project partial mode updates into the light or dark branch expected by Studio theme mutations. */
export function createThemeModeUpdates(
  mode: ActiveThemeMode,
  updates: Partial<ThemeModeConfig>,
): { readonly light?: Partial<ThemeModeConfig>; readonly dark?: Partial<ThemeModeConfig> } {
  return mode === 'dark' ? { dark: updates } : { light: updates };
}

/***
 * Resolve the source color/harmony values used to seed ZORA theme administration for one mode.
 * @todo Keep this ZORA/theme bridge with the theme owner rather than generic UI.
 */
export function resolveZoraThemeSourceModeConfig(args: {
  readonly theme: ThemeConfig;
  readonly mode: ActiveThemeMode;
}): Pick<ThemeModeConfig, 'primaryColor' | 'harmony'> {
  return args.theme[args.mode];
}

/***
 * Clone the theme and both mode configs before passing it into mutable/derived ZORA surface theme flows.
 * @todo Keep this theme-boundary adapter with theme/ZORA integration ownership.
 */
export function resolveZoraSurfaceThemeConfig(theme: ThemeConfig): ThemeConfig {
  return {
    ...theme,
    light: { ...theme.light },
    dark: { ...theme.dark },
  };
}
