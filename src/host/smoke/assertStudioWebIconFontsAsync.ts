import type { ChromeNavigationSession } from './ChromeNavigationSession';

const STUDIO_WEB_ICON_FONT_FAMILIES = [
  'FontAwesome',
  'FontAwesome5Brands-Regular',
  'FontAwesome5Free-Regular',
  'FontAwesome5Free-Solid',
  'FontAwesome6Brands-Regular',
  'FontAwesome6Free-Regular',
  'FontAwesome6Free-Solid',
  'Ionicons',
] as const;

/*** Assert that the Studio web smoke fixture loads and uses the expected icon-font families.
 * @todo Move this browser acceptance assertion from src/host/smoke to test/smoke.
 */
export async function assertStudioWebIconFontsAsync(
  browser: ChromeNavigationSession,
): Promise<void> {
  await browser.waitForLoadedFontFamiliesAsync(STUDIO_WEB_ICON_FONT_FAMILIES);
  await browser.assertRoleUsesFontFamilyAsync('button', 'Go to projects', 'Ionicons');
  await browser.assertRoleUsesFontFamilyAsync('button', 'New project', 'Ionicons');
}
