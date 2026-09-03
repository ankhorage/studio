import { useZoraTheme } from '@ankhorage/zora';

import { useStudio } from '../../../core/StudioContext';
import type { ThemeUpdates } from '../../../index';
import { type ActiveThemeModeSelection, resolveActiveThemeModeSelection } from './adminThemeModel';

interface ActiveThemeAdminState {
  readonly mode: 'light' | 'dark';
  readonly selection: ActiveThemeModeSelection | null;
  readonly setMode: (mode: 'light' | 'dark') => void;
  readonly updateTheme: (updates: ThemeUpdates) => void;
}

/***
 * Compose Studio manifest theme selection with the active ZORA surface mode and expose a mode-scoped theme update adapter.
 * @todo Keep this React/ZORA bridge at the theme-admin UI edge while active-theme policy and mutations move to the theme application domain.
 */
export function useActiveThemeAdmin(): ActiveThemeAdminState {
  const studio = useStudio();
  const { mode, setMode } = useZoraTheme();
  const selection = studio.manifest
    ? resolveActiveThemeModeSelection({
        themes: studio.manifest.themes,
        activeThemeId: studio.manifest.activeThemeId,
        surfaceMode: mode,
      })
    : null;

  /*** Apply partial theme updates to the currently resolved active theme when one exists. */
  const updateTheme = (updates: ThemeUpdates) => {
    if (!selection) return;
    studio.updateTheme(selection.theme.id, updates);
  };

  return { mode, selection, setMode, updateTheme };
}
