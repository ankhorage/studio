import { CATEGORY_PRESETS, listTemplates } from '@ankhorage/templates';
import { expect, test } from 'bun:test';

import { getTemplateImageFileName, getTemplateCatalog } from './index';

test('projects every published template into its category catalog', () => {
  const catalog = getTemplateCatalog();
  expect(catalog.categories).toHaveLength(Object.keys(CATEGORY_PRESETS).length);
  expect(catalog.categories).toEqual(
    expect.arrayContaining(
      Object.keys(CATEGORY_PRESETS).map((category) =>
        expect.objectContaining({
          id: category,
          templateCount: listTemplates(category as keyof typeof CATEGORY_PRESETS).length,
        }),
      ),
    ),
  );
});

test('preserves template image filenames independently from their display names', () => {
  expect(getTemplateImageFileName('assets/images/home-hero.webp')).toBe('home-hero.webp');
});
