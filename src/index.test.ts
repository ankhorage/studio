import type { UiNode } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import {
  ACTION_REGISTRY,
  buildInsertCatalogEntries,
  cloneWithNewIds,
  createNodeFromCatalogEntry,
  findNodeById,
  insertNodeAtPlacement,
  moveNodeToPlacement,
  resolveDefaultInsertPlacement,
  resolveInsertCatalogEntries,
  STUDIO_PACKAGE_BOUNDARY,
  STUDIO_PACKAGE_NAME,
  STUDIO_PUBLIC_CONTRACTS,
  type StudioComponentMetaRegistry,
  TPL_SCREEN_EMPTY,
  updateNodeInTree,
} from './index';

const componentMeta: StudioComponentMetaRegistry = {
  Screen: {
    category: 'layout',
    allowedChildren: ['Section', 'Text'],
    directManifestNode: true,
    blueprint: { label: 'Screen' },
  },
  Section: {
    category: 'layout',
    allowedChildren: ['Text'],
    directManifestNode: true,
    blueprint: { label: 'Section', defaultProps: { gap: 12 } },
  },
  Text: {
    category: 'component',
    allowedChildren: [],
    directManifestNode: true,
    blueprint: { label: 'Text', defaultProps: { children: 'Text' } },
  },
  InternalOnly: {
    category: 'component',
    allowedChildren: [],
    directManifestNode: false,
    blueprint: { label: 'Internal only' },
  },
};

const createRoot = (): UiNode => ({
  id: 'screen',
  type: 'Screen',
  props: {},
  children: [
    {
      id: 'section-a',
      type: 'Section',
      props: {},
      children: [
        {
          id: 'text-a',
          type: 'Text',
          props: { children: 'A' },
          children: [],
        },
      ],
    },
    {
      id: 'section-b',
      type: 'Section',
      props: {},
      children: [],
    },
  ],
});

describe('@ankhorage/studio', () => {
  test('exports the package name', () => {
    expect(STUDIO_PACKAGE_NAME).toBe('@ankhorage/studio');
  });

  test('documents the package boundary', () => {
    const { consumes, doesNotOwn, owns } = STUDIO_PACKAGE_BOUNDARY;

    expect(owns).toContain('Studio authoring contracts');
    expect(owns).toContain('Studio command and event contracts');
    expect(owns).toContain('Studio authoring model helpers');
    expect(consumes).toContain('@ankhorage/contracts');
    expect(consumes).toContain('@ankhorage/runtime');
    expect(doesNotOwn).toContain('Expo runtime planning');
    expect(doesNotOwn).toContain('React Native UI components');
  });

  test('lists useful public contract exports', () => {
    expect(STUDIO_PUBLIC_CONTRACTS).toContain('StudioManifest');
    expect(STUDIO_PUBLIC_CONTRACTS).toContain('StudioContextValue');
    expect(STUDIO_PUBLIC_CONTRACTS).toContain('NodePlacement');
    expect(STUDIO_PUBLIC_CONTRACTS).toContain('InsertCatalogEntry');
    expect(STUDIO_PUBLIC_CONTRACTS).toContain('StudioCommand');
    expect(STUDIO_PUBLIC_CONTRACTS).toContain('StudioEvent');
    expect(STUDIO_PUBLIC_CONTRACTS).toContain('StudioComponentMetaRegistry');
    expect(STUDIO_PUBLIC_CONTRACTS).toContain('buildInsertCatalogEntries');
  });

  test('exports package-neutral action definitions', () => {
    expect(ACTION_REGISTRY.navigate.payloadSchema?.route?.required).toBe(true);
    expect(ACTION_REGISTRY.toggleDarkMode.requiresPayload).toBe(false);
  });

  test('resolves default insertion placement inside the selected node', () => {
    const placement = resolveDefaultInsertPlacement({
      root: createRoot(),
      selectedNodeId: 'section-b',
      childType: 'Text',
      componentMeta,
    });

    expect(placement).toEqual({
      ok: true,
      placement: {
        parentId: 'section-b',
        index: 0,
        kind: 'inside',
      },
    });
  });

  test('falls back to after selected node when inside placement is invalid', () => {
    const placement = resolveDefaultInsertPlacement({
      root: createRoot(),
      selectedNodeId: 'text-a',
      childType: 'Text',
      componentMeta,
    });

    expect(placement).toEqual({
      ok: true,
      placement: {
        parentId: 'section-a',
        index: 1,
        kind: 'after',
        referenceId: 'text-a',
      },
    });
  });

  test('builds and resolves insert catalog entries without owning component metadata', () => {
    const root = createRoot();
    const entries = buildInsertCatalogEntries({
      componentMeta,
      recipes: [
        {
          id: 'section-text',
          label: 'Section with text',
          category: 'recipe',
          root: { type: 'Section', children: [{ type: 'Text' }] },
        },
      ],
    });
    const resolvedEntries = resolveInsertCatalogEntries({
      entries,
      root,
      selectedNodeId: 'section-b',
      componentMeta,
    });

    const textEntry = resolvedEntries.find((entry) => entry.id === 'component:Text');
    const internalEntry = resolvedEntries.find((entry) => entry.id === 'component:InternalOnly');
    const recipeEntry = resolvedEntries.find((entry) => entry.id === 'recipe:section-text');

    expect(textEntry?.status).toBe('enabled');
    expect(textEntry?.placement).toEqual({ parentId: 'section-b', index: 0, kind: 'inside' });
    expect(internalEntry?.status).toBe('disabled');
    expect(internalEntry?.disabledReason?.code).toBe('not-direct');
    expect(recipeEntry?.status).toBe('enabled');
  });

  test('creates and inserts a catalog entry node at a placement', () => {
    const root = createRoot();
    const entry = buildInsertCatalogEntries({ componentMeta }).find(
      (candidate) => candidate.id === 'component:Text',
    );

    if (!entry) {
      throw new Error('Expected Text catalog entry.');
    }

    const insertion = insertNodeAtPlacement({
      root,
      placement: { parentId: 'section-b', index: 0, kind: 'inside' },
      componentMeta,
      makeNode: () =>
        createNodeFromCatalogEntry(
          entry,
          componentMeta,
          (prefix) => `${prefix?.toLowerCase() ?? 'node'}-created`,
        ),
    });

    if (!insertion) {
      throw new Error('Expected catalog entry insertion to succeed.');
    }

    expect(insertion.insertedNodeId).toBe('text-created');
    expect(findNodeById(insertion.root, 'text-created')?.props).toEqual({ children: 'Text' });
  });

  test('moves a node to a resolved placement', () => {
    const root = createRoot();
    const movement = moveNodeToPlacement({
      root,
      nodeId: 'text-a',
      placement: { parentId: 'section-b', index: 0, kind: 'inside' },
      componentMeta,
    });

    if (!movement) {
      throw new Error('Expected node movement to succeed.');
    }

    expect(movement.movedNodeId).toBe('text-a');
    expect(findNodeById(movement.root, 'section-a')?.children).toEqual([]);
    expect(findNodeById(movement.root, 'section-b')?.children?.[0]?.id).toBe('text-a');
  });

  test('updates node props and clones empty screen templates with new ids', () => {
    const updated = updateNodeInTree(createRoot(), 'text-a', {
      children: 'Updated',
      alias: 'intro-copy',
      style: { marginTop: 12 },
    });

    const updatedNode = findNodeById(updated, 'text-a');
    expect(updatedNode?.props).toEqual({ children: 'Updated' });
    expect(updatedNode?.alias).toBe('intro-copy');
    expect(updatedNode?.style).toEqual({ marginTop: 12 });

    let counter = 0;
    const cloned = cloneWithNewIds(TPL_SCREEN_EMPTY, (prefix) => `${prefix}-${++counter}`);

    expect(cloned.id).toBe('Screen-1');
    expect(cloned.children?.[0]?.id).toBe('SectionHeader-2');
    expect(cloned.children?.[0]?.id).not.toBe(TPL_SCREEN_EMPTY.children?.[0]?.id);
  });
});
