import type { ZoraThemeTokenFamily } from '@ankhorage/zora';

interface ThemeRecipeTokenSource {
  readonly colors: object;
  readonly spacing: object;
  readonly radii: object;
  readonly shadows: object;
  readonly typography: {
    readonly sizes: object;
    readonly weights: object;
    readonly headings: object;
  };
}

export function resolveThemeRecipeTokenOptions(
  theme: ThemeRecipeTokenSource,
  family: ZoraThemeTokenFamily,
): readonly string[] {
  if (family === 'colors') return Object.keys(theme.colors).sort();
  if (family === 'spacing') return Object.keys(theme.spacing).sort();
  if (family === 'radii') return Object.keys(theme.radii).sort();
  if (family === 'shadows') return Object.keys(theme.shadows).sort();

  return Array.from(
    new Set([
      ...Object.keys(theme.typography.sizes),
      ...Object.keys(theme.typography.weights),
      ...Object.keys(theme.typography.headings),
    ]),
  ).sort();
}
