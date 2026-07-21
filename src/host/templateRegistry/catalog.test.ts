import { expect, test } from 'bun:test';

import { getTemplateCatalog } from './index';

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
