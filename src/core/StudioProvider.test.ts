import { expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const source = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'StudioProvider.ts'),
  'utf8',
);

test('uses canonical manifestState mutations for provider authoring state', () => {
  expect(source).toContain('updateStudioManifestDraftTheme');
  expect(source).toContain('updateStudioManifestDraftNode');
  expect(source).toContain('updateStudioManifestDraftAuthSettings');
  expect(source).not.toContain('updateNode: noop');
  expect(source).not.toContain('updateTheme: (_id: string, _updates: ThemeUpdates)');
  expect(source).not.toContain('deleteNode: noop');
  expect(source).not.toContain('insertFromCatalogEntry: (_entry');
  expect(source).not.toContain('moveNodeToPlacement: (_nodeId');
  expect(source).toContain('insertStudioManifestNodeAtPlacement');
  expect(source).toContain('moveStudioManifestNodeToPlacement');
  expect(source).toContain('deleteStudioManifestNode');
  expect(source).toContain('addStudioManifestScreen');
  expect(source).toContain('deleteStudioManifestScreen');
  expect(source).toContain('hasCanonicalStudioScreenRegistryIdentity');
  expect(source).toContain('moveStudioManifestRoute');
  expect(source).toContain('setStudioManifestRoutePrimaryNavigationVisibility');
  expect(source).not.toContain('reorderScreens:');
  expect(source).toContain('createNodeFromCatalogEntry');
});

test('requires caller-injected component metadata for package-neutral placement', () => {
  expect(source).toContain('componentMeta: StudioComponentMetaRegistry');
  expect(source).toContain('componentMeta,');
  expect(source).not.toContain("from '@ankhorage/zora'");
});

test('owns Studio draft hydration and autosave through the host manifest boundary', () => {
  expect(source).toContain('/manifest');
  expect(source).toContain('createStudioManifestSignature');
  expect(source).toContain('StudioManifestPersistenceCoordinator');
  expect(source).toContain('lastPersistedSignatureRef');
  expect(source).toContain('createStudioManifestSignature(currentManifest) !== loadedSignature');
  expect(source).toContain('refetchManifest: persistence.refetchManifest');
  expect(source).toContain('flushManifest: persistence.flushManifest');
  expect(source).not.toContain('pendingSaveRef');
});

test('reconciles stale selected node ids against the canonical active root', () => {
  expect(source).toContain(
    'resolveScreenIdForPathname(manifest.navigator, activePathname, manifest.screens)',
  );
  expect(source).toContain('resolveActiveRootNode(manifest, activeScreenId)');
  expect(source).toContain('setRequestedActiveScreenId');
  expect(source).toContain('resolveStudioSelectedNodeId(rootNode, selectedNodeId)');
  expect(source).toContain('if (selectedNodeId !== nextSelectedNodeId)');
  expect(source).toContain('selectNode(nextSelectedNodeId)');
  expect(source).toContain('}, [rootNode, selectedNodeId]);');
});

test('owns the stable Auth admin session for the Studio project lifetime', () => {
  expect(source).toContain('AuthAdminSessionProvider');
  expect(source).toContain('key: projectId');
  expect(source).toContain('projectId,');
  expect(source).toContain('React.createElement(StudioContext.Provider');
});
