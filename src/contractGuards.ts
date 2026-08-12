import { COLOR_HARMONIES, type ColorHarmony } from '@ankhorage/color-theory';
import {
  APP_CATEGORIES,
  type AppCategory,
  isAppManifest,
} from '@ankhorage/contracts';

const APP_CATEGORY_SET = new Set<string>(APP_CATEGORIES);
const COLOR_HARMONY_SET = new Set<string>(COLOR_HARMONIES);

export { isAppManifest };

export function isAppCategory(value: unknown): value is AppCategory {
  return typeof value === 'string' && APP_CATEGORY_SET.has(value);
}

export function isColorHarmony(value: unknown): value is ColorHarmony {
  return typeof value === 'string' && COLOR_HARMONY_SET.has(value);
}
