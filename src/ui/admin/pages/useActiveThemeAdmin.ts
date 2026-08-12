import { useZoraTheme } from '@ankhorage/zora';

import { useStudio } from '../../../core/StudioContext';
import type { ThemeUpdates } from '../../../index';
import { resolveActiveThemeModeSelection } from './adminThemeModel';

export function useActiveThemeAdmin() {
  const studio = useStudio();
  const { mode, setMode, theme: resolvedTheme } = useZoraTheme();
  const selection = studio.manifest
    ? resolveActiveThemeModeSelection({
        themes: studio.manifest.themes,
        activeThemeId: studio.manifest.activeThemeId,
        surfaceMode: mode,
      })
    : null;

  const updateTheme = (updates: ThemeUpdates) => {
    if (!selection) return;
    studio.updateTheme(selection.theme.id, updates);
  };

  return { mode, resolvedTheme, selection, setMode, updateTheme };
}
