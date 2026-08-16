import { expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const source = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'AnkhAdminShell.tsx'),
  'utf8',
);

test('uses canonical admin path helpers for navigation', () => {
  expect(source).toContain('createStudioAdminRoutePath');
  expect(source).not.toContain("'/ankh/properties/' +");
  expect(source).not.toContain('`/ankh/properties/${');
});

test('uses explicit shell composition without nested SettingsLayout headers', () => {
  expect(source).toContain('AppBar');
  expect(source).toContain('SidebarLayout');
  expect(source).not.toContain('SettingsLayout');
});

test('uses the canonical lg responsive contract and bounded wide shell', () => {
  expect(source).toContain('const COMPACT_VISIBILITY = { base: true, lg: false } as const;');
  expect(source).toContain('sizing="fill"');
  expect(source).not.toContain('useWindowDimensions');
  expect(source).not.toContain('width < 900');
  expect(source).not.toContain('1024');
});

test('uses parent-aware active navigation state', () => {
  expect(source).toContain('isStudioAdminRouteActive');
  expect(source).not.toContain('NavigationList');
});

test('does not own project-lifetime Auth admin session state at route-shell lifetime', () => {
  expect(source).not.toContain('AuthAdminSessionProvider');
  expect(source).not.toContain('key={studio.projectId}');
});
