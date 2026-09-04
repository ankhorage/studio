import { CATEGORY_PRESETS, listTemplates } from '@ankhorage/templates';
import { expect, test } from 'bun:test';

import { getTemplateCatalog } from './index';

test('keeps the category catalog valid when no standalone templates are published', () => {
  expect(listTemplates()).toEqual([]);

  const catalog = getTemplateCatalog();
  expect(catalog.categories).toHaveLength(Object.keys(CATEGORY_PRESETS).length);
  expect(catalog.categories.every((category) => category.templateCount === 0)).toBe(true);
  expect(catalog.categories.every((category) => category.templates.length === 0)).toBe(true);
});
