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

test('uses explicit shell composition without removed ZORA layout wrappers', () => {
  expect(source).toContain('AppBar');
  expect(source).toContain('Dialog');
  expect(source).toContain('desktopLayout');
  expect(source).not.toContain('SidebarLayout');
  expect(source).not.toContain('Show');
  expect(source).not.toContain('Modal');
  expect(source).not.toContain('SettingsLayout');
});

test('uses a bounded compact breakpoint for the current shell composition', () => {
  expect(source).toContain('const COMPACT_MAX_WIDTH = 1023;');
  expect(source).toContain('useWindowDimensions');
  expect(source).not.toContain('COMPACT_VISIBILITY');
  expect(source).not.toContain('sizing="fill"');
});

test('uses parent-aware active navigation state', () => {
  expect(source).toContain('isStudioAdminRouteActive');
  expect(source).not.toContain('NavigationList');
});

test('does not own project-lifetime Auth admin session state at route-shell lifetime', () => {
  expect(source).not.toContain('AuthAdminSessionProvider');
  expect(source).not.toContain('key={studio.projectId}');
});
