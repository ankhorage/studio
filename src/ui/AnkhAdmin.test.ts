import { expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const source = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'AnkhAdmin.tsx'),
  'utf8',
);

test('uses canonical admin path helpers for navigation and properties decoding', () => {
  expect(source).toContain('createStudioAdminRoutePath');
  expect(source).toContain('resolveStudioPropertiesNodeId');
  expect(source).not.toContain("'/ankh/properties/' +");
  expect(source).not.toContain('`/ankh/properties/${');
});

test('uses explicit shell composition without nested SettingsLayout headers', () => {
  expect(source).toContain('AppBar');
  expect(source).toContain('SidebarLayout');
  expect(source).not.toContain('SettingsLayout');
});
