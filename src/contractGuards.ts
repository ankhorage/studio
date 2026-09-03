import { COLOR_HARMONIES, type ColorHarmony } from '@ankhorage/color-theory';
import { APP_CATEGORIES, type AppCategory, isAppManifest } from '@ankhorage/contracts';

const APP_CATEGORY_SET = new Set<string>(APP_CATEGORIES);
const COLOR_HARMONY_SET = new Set<string>(COLOR_HARMONIES);

export { isAppManifest };

/***
 * Narrow an unknown value to an application category defined by the contracts package.
 * @todo Move this reusable domain guard to @ankhorage/contracts beside APP_CATEGORIES.
 */
export function isAppCategory(value: unknown): value is AppCategory {
  return typeof value === 'string' && APP_CATEGORY_SET.has(value);
}

/***
 * Narrow an unknown value to a color harmony defined by the color-theory package.
 * @todo Move this reusable domain guard to @ankhorage/color-theory beside COLOR_HARMONIES.
 */
export function isColorHarmony(value: unknown): value is ColorHarmony {
  return typeof value === 'string' && COLOR_HARMONY_SET.has(value);
}
