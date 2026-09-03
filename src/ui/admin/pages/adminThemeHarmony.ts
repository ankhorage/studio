import type { ThemeModeConfig } from '@ankhorage/contracts';

export const SUPPORTED_COLOR_HARMONIES = [
  'monochromatic',
  'analogous',
  'complementary',
  'triadic',
  'tetradic',
  'splitComplementary',
] as const satisfies readonly ThemeModeConfig['harmony'][];

/***
 * Convert a camelCase identifier into a space-separated human label with an initial capital.
 * @utility @ankhorage/utility/string
 */
export function formatHarmonyLabel(harmony: ThemeModeConfig['harmony']): string {
  return harmony.replace(/([A-Z])/g, ' $1').replace(/^./, (value) => value.toUpperCase());
}
