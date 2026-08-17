import { expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  resolveStudioAppBarContextActions,
  resolveStudioAppBarModeAction,
} from './studioAppBarModel';

function readUiSource(fileName: string): string {
  return readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), fileName), 'utf8');
}

test('uses the URL as the admin route source of truth', () => {
  const source = readUiSource('useStudioAppBarAugmentation.ts');
  const actionSource = readUiSource('createStudioAppBarActions.ts');

  expect(source).toContain('usePathname()');
  expect(source).toContain('useRouter()');
  expect(source).toContain("router.push('/ankh')");
  expect(source).toContain('createStudioBindingsRoutePath');
  expect(source).toContain('resolveStudioLastNonAdminLocation');
  expect(source).toContain('setLastNonAdminLocation(appLocation)');
  expect(actionSource).toContain("label: 'Administration'");
  expect(actionSource).toContain("key: 'preview-mode'");
  expect(actionSource).toContain('handlers.togglePreviewMode');
  expect(source).toContain('isStudioAdminPath(pathname)');
  expect(source).not.toContain('setActiveRoute');
});

test('returns keyed AppBar actions as flat direct children in intentional order', () => {
  const source = readUiSource('useStudioAppBarAugmentation.ts');
  const actionSource = readUiSource('createStudioAppBarActions.ts');

  expect(actionSource).toContain("key: 'administration'");
  expect(actionSource).toContain("key: 'preview-mode'");
  expect(actionSource).toContain('...contextActions.map((action) =>');
  expect(actionSource).toContain('key: action.id');
  expect(source).toContain('isAdminPath || studio.previewMode');
  expect(source).toContain('StudioInsertDialog');
  expect(source).toContain('StudioDeleteDialog');
  expect(actionSource.indexOf("key: 'administration'")).toBeLessThan(
    actionSource.indexOf("key: 'preview-mode'"),
  );
  expect(actionSource.indexOf("key: 'preview-mode'")).toBeLessThan(
    actionSource.indexOf('...contextActions.map((action) =>'),
  );
});

test('resolves an obvious reversible Preview mode action', () => {
  expect(resolveStudioAppBarModeAction(false)).toEqual({
    label: 'Preview',
    icon: { name: 'eye-outline' },
    color: 'neutral',
    variant: 'ghost',
  });
  expect(resolveStudioAppBarModeAction(true)).toEqual({
    label: 'Edit',
    icon: { name: 'create-outline' },
    color: 'primary',
    variant: 'solid',
  });
});

test('suppresses all authoring context actions in Preview', () => {
  const actions = resolveStudioAppBarContextActions({
    selectedNodeId: 'child',
    parentNodeId: 'root',
    canInsert: true,
    canInsertInside: true,
    canDelete: true,
    previewMode: true,
  });

  expect(actions).toEqual([]);
});

test('does not mount authoring overlays while Preview is active', () => {
  const source = readUiSource('useStudioAppBarAugmentation.ts');

  expect(source).toContain('isAdminPath || studio.previewMode');
  expect(source).toContain('setInsertVisible(false)');
  expect(source).toContain('setDeleteCandidateId(null)');
  expect(source).toContain('setActivePanelId(null)');
});

test('resolves contextual app bar actions for selected nodes', () => {
  const actions = resolveStudioAppBarContextActions({
    selectedNodeId: 'child',
    parentNodeId: 'root',
    canInsert: true,
    canInsertInside: true,
    canDelete: true,
  });

  expect(actions).toEqual([
    { id: 'properties', label: 'Properties' },
    { id: 'bindings', label: 'Bindings' },
    { id: 'insert', label: 'Add child' },
    { id: 'delete', label: 'Delete' },
    { id: 'selectParent', label: 'Select parent' },
    { id: 'clearSelection', label: 'Clear selection' },
  ]);
});

test('omits parent selection when no parent is available', () => {
  const actions = resolveStudioAppBarContextActions({
    selectedNodeId: 'root',
    parentNodeId: null,
    canInsert: true,
    canInsertInside: true,
    canDelete: false,
  });

  expect(actions).toEqual([
    { id: 'properties', label: 'Properties' },
    { id: 'bindings', label: 'Bindings' },
    { id: 'insert', label: 'Add child' },
    { id: 'clearSelection', label: 'Clear selection' },
  ]);
});

test('returns no contextual app bar actions when no valid selection exists', () => {
  const actions = resolveStudioAppBarContextActions({
    selectedNodeId: null,
    parentNodeId: null,
    canInsert: false,
    canInsertInside: false,
    canDelete: false,
  });

  expect(actions).toEqual([]);
});

test('uses generic Insert wording for sibling-only placement and omits unavailable actions', () => {
  const actions = resolveStudioAppBarContextActions({
    selectedNodeId: 'leaf',
    parentNodeId: 'root',
    canInsert: true,
    canInsertInside: false,
    canDelete: false,
  });

  expect(actions.map((action) => action.id)).toEqual([
    'properties',
    'bindings',
    'insert',
    'selectParent',
    'clearSelection',
  ]);
  expect(actions.find((action) => action.id === 'insert')?.label).toBe('Insert');
  expect(actions.find((action) => action.id === 'delete')).toBeUndefined();
});
