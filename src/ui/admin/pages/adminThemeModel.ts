import type {
  AppManifest,
  ThemeConfig,
  ThemeModeConfig,
  ThemeRegistry,
} from '@ankhorage/contracts';
import { readOwnProperty } from '@ankhorage/utility/object';

import type { ThemeUpdates } from '../../../index';

type ActiveThemeMode = NonNullable<AppManifest['activeThemeMode']>;

export interface ActiveThemeModeSelection {
  readonly theme: ThemeConfig;
  readonly mode: ActiveThemeMode;
  readonly modeConfig: ThemeModeConfig;
}

/***
 * Resolve the active theme by configured id, then select the requested light/dark mode config.
 * @todo Move active-theme selection policy from admin UI into the theme domain/application model.
 */
export function resolveActiveThemeModeSelection(args: {
  readonly themes: ThemeRegistry;
  readonly activeThemeId: string | undefined;
  readonly surfaceMode: ActiveThemeMode;
}): ActiveThemeModeSelection | null {
  if (!args.activeThemeId) return null;
  const theme = readOwnProperty<ThemeConfig>(args.themes, args.activeThemeId);
  if (!theme) return null;

  const modeConfig = theme[args.surfaceMode];

  return { theme, mode: args.surfaceMode, modeConfig };
}

/*** Create a full Theme patch that preserves explicit removal of optional authored top-level state. */
export function createThemeReplacementUpdates(theme: ThemeConfig): ThemeUpdates {
  return {
    name: theme.name,
    light: theme.light,
    dark: theme.dark,
    tokens: theme.tokens,
    recipes: theme.recipes,
  };
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
