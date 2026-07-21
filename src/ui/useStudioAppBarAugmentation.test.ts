import { expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { resolveStudioAppBarContextActions } from './studioAppBarModel';

test('uses the URL as the admin route source of truth', () => {
  const source = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'useStudioAppBarAugmentation.ts'),
    'utf8',
  );

  expect(source).toContain('usePathname()');
  expect(source).toContain('useRouter()');
  expect(source).toContain("router.push('/ankh')");
  expect(source).toContain('resolveStudioLastNonAdminLocation');
  expect(source).toContain('studio.setLastNonAdminLocation(appLocation)');
  expect(source).toContain('Administration');
  expect(source).toContain('isStudioAdminPath(pathname)');
  expect(source).not.toContain('useState<');
  expect(source).not.toContain('setActiveRoute');
});

test('resolves contextual app bar actions for selected nodes', () => {
  const actions = resolveStudioAppBarContextActions({
    pathname: '/preview',
    selectedNodeId: 'child',
    parentNodeId: 'root',
    onAdministration: () => undefined,
    onProperties: () => undefined,
    onSelectParent: () => undefined,
    onClearSelection: () => undefined,
  });

  expect(actions).toEqual([
    { id: 'properties', label: 'Properties' },
    { id: 'selectParent', label: 'Select parent' },
    { id: 'clearSelection', label: 'Clear selection' },
  ]);
});

test('omits parent selection when no parent is available', () => {
  const actions = resolveStudioAppBarContextActions({
    pathname: '/preview',
    selectedNodeId: 'root',
    parentNodeId: null,
    onAdministration: () => undefined,
    onProperties: () => undefined,
    onSelectParent: () => undefined,
    onClearSelection: () => undefined,
  });

  expect(actions).toEqual([
    { id: 'properties', label: 'Properties' },
    { id: 'clearSelection', label: 'Clear selection' },
  ]);
});
