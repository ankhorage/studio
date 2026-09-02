import { CATEGORY_PRESETS } from '@ankhorage/templates';
import { expect, test } from 'bun:test';

import { getProjectTemplate, getTemplateCatalog } from './index';

test('exposes one grouped template catalog without template versions', () => {
  const catalog = getTemplateCatalog();
  const developerTools = catalog.categories.find((category) => category.id === 'developer_tools');

  expect(catalog.categories.length).toBeGreaterThan(0);
  expect(developerTools).toBeDefined();
  expect(developerTools?.label).toBe('Developer Tools');
  expect(developerTools?.templateCount).toBe(developerTools?.templates.length);
  expect(developerTools?.templates.length).toBeGreaterThan(0);

  const [template] = developerTools?.templates ?? [];
  expect(template).toBeDefined();
  if (!template) return;

  expect(Object.keys(template).sort()).toEqual(['description', 'id', 'name', 'templateId']);
  expect(typeof template.id).toBe('string');
  expect(typeof template.templateId).toBe('string');
  expect(typeof template.name).toBe('string');
  expect(typeof template.description).toBe('string');
  expect('category' in template).toBe(false);
  expect('version' in template).toBe(false);
});

test('uses the primary design recommendations and returns template manifests', () => {
  const category = 'developer_tools';
  const preset = CATEGORY_PRESETS.developer_tools;
  const catalogCategory = getTemplateCatalog().categories.find((entry) => entry.id === category);
  const templateId = catalogCategory?.templates[0]?.templateId;

  expect(catalogCategory?.primaryColor).toBe(preset.recommendedPrimaryColors[0]);
  expect(catalogCategory?.harmony).toBe(preset.recommendedHarmonies[0]);
  expect(templateId).toBeDefined();
  if (!templateId) return;

  const manifest = getProjectTemplate({ category, templateId });

  expect(manifest.metadata.name).toBe(preset.defaultName);
  expect(manifest.themes[0]?.light.primaryColor).toBe(preset.recommendedPrimaryColors[0]);
  expect(manifest.themes[0]?.light.harmony).toBe(preset.recommendedHarmonies[0]);
});
