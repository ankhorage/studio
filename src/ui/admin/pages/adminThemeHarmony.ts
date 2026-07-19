import type { ThemeModeConfig } from '@ankhorage/contracts';

export const SUPPORTED_COLOR_HARMONIES = [
  'monochromatic',
  'analogous',
  'complementary',
  'triadic',
  'tetradic',
  'splitComplementary',
] as const satisfies readonly ThemeModeConfig['harmony'][];

export function formatHarmonyLabel(harmony: ThemeModeConfig['harmony']): string {
  return harmony.replace(/([A-Z])/g, ' $1').replace(/^./, (value) => value.toUpperCase());
}
