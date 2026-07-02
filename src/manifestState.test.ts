import type { RouteDefinition, UiNode } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import type { NodePlacement, StudioComponentMetaRegistry, StudioManifest } from './index';
import {
  addStudioManifestScreen,
  addStudioManifestTheme,
  createStudioManifestFingerprint,
  deleteStudioManifestNode,
  deleteStudioManifestScreen,
  findScreenIdForNode,
  insertStudioManifestNodeAtPlacement,
  listScreenIdsInRouteOrder,
  moveStudioManifestNode,
  moveStudioManifestNodeToPlacement,
  resolveActiveRootNode,
  resolveInitialActiveScreenId,
  resolveSafeSelectedNodeId,
  setStudioManifestNavigatorInitialRoute,
  setStudioManifestNavigatorType,
  updateStudioManifestModuleConfig,
  updateStudioManifestNode,
  updateStudioManifestOAuthProviders,
  updateStudioManifestTheme,
} from './manifestState';

const componentMeta: StudioComponentMetaRegistry = {
  Screen: {
    category: 'layout',
    allowedChildren: ['Section', 'Text', 'Button'],
    directManifestNode: true,
  },
  Section: {
    category: 'layout',
    allowedChildren: ['Text', 'Button'],
    directManifestNode: true,
  },
  Text: {
    category: 'component',
    allowedChildren: [],
    directManifestNode: true,
  },
  Button: {
    category: 'component',
    allowedChildren: [],
    directManifestNode: true,
  },
};

function createManifest(): StudioManifest {
  return {
    navigator: {
      type: 'tabs',
      initialRouteName: 'home',
      routes: [
        { name: 'home', label: 'Home', screenId: 'screen-home' },
        { name: 'about', label: 'About', screenId: 'screen-about' },
      ],
    },
    screens: {
      'screen-home': {
        id: 'screen-home',
        name: 'Home',
        title: 'Home',
        root: {
          id: 'root-home',
          type: 'Screen',
          children: [
            {
              id: 'section-1',
              type: 'Section',
              children: [
                { id: 'text-1', type: 'Text', props: { children: 'Hello' } },
                { id: 'button-1', type: 'Button', props: { children: 'Click' } },
              ],
            },
          ],
        },
      },
      'screen-about': {
        id: 'screen-about',
        name: 'About',
        title: 'About',
        root: {
          id: 'root-about',
          type: 'Screen',
          children: [{ id: 'about-text', type: 'Text', props: { children: 'About' } }],
        },
      },
    },
    data: {},
    dataBindings: {
      'text-1': { sourceId: 'source-1', path: '$.title' },
    },
    dataSources: {},
    themes: [
      {
        id: 'theme-1',
        name: 'Theme 1',
        light: { primaryColor: '#111111', harmony: 'monochromatic' },
        dark: { primaryColor: '#222222', harmony: 'monochromatic' },
      },
    ],
    activeThemeId: 'theme-1',
    activeThemeMode: 'light',
    settings: {
      localization: {
        defaultLocale: 'en',
        locales: ['en'],
      },
    },
    infra: {
      modulesConfig: {},
    },
  } as unknown as StudioManifest;
}

function makeIdFactory(): (prefix?: string) => string {
  let index = 0;
  return (prefix = 'id') => {
    index += 1;
    return `${prefix.toLowerCase()}-${index}`;
  };
}

describe('manifestState', () => {
  test('resolves active screen/root and safe selection', () => {
    const manifest = createManifest();

    expect(listScreenIdsInRouteOrder(manifest.navigator.routes)).toEqual([
      'screen-home',
      'screen-about',
    ]);
    expect(resolveInitialActiveScreenId(manifest)).toBe('screen-home');
    expect(resolveActiveRootNode(manifest, 'screen-home')?.id).toBe('root-home');
    expect(resolveSafeSelectedNodeId(resolveActiveRootNode(manifest, 'screen-home'), 'text-1')).toBe(
      'text-1',
    );
    expect(resolveSafeSelectedNodeId(resolveActiveRootNode(manifest, 'screen-home'), 'ghost')).toBe(
      null,
    );
    expect(findScreenIdForNode(manifest, 'about-text')).toBe('screen-about');
  });

  test('creates manifest fingerprints from model-relevant fields', () => {
    const first = createManifest();
    const second = updateStudioManifestNode(first, 'screen-home', 'text-1', { children: 'Hi' });

    expect(createStudioManifestFingerprint(first)).not.toBe(createStudioManifestFingerprint(second));
  });

  test('updates and deletes nodes in a screen manifest', () => {
    const manifest = createManifest();
    const updated = updateStudioManifestNode(manifest, 'screen-home', 'text-1', {
      children: 'Updated',
      alias: 'Hero copy',
    });
    const updatedText = resolveActiveRootNode(updated, 'screen-home')?.children?.[0]?.children?.[0];
    expect(updatedText?.props?.children).toBe('Updated');
    expect(updatedText?.alias).toBe('Hero copy');

    const deleted = deleteStudioManifestNode(updated, 'screen-home', 'text-1');
    expect(JSON.stringify(resolveActiveRootNode(deleted, 'screen-home'))).not.toContain('text-1');
    expect(deleted.dataBindings['text-1']).toBeUndefined();
  });

  test('inserts and moves nodes with package-neutral component metadata', () => {
    const manifest = createManifest();
    const newNode: UiNode = { id: 'text-2', type: 'Text', props: { children: 'Inserted' } };
    const placement: NodePlacement = { parentId: 'section-1', index: 1, kind: 'inside' };
    const inserted = insertStudioManifestNodeAtPlacement({
      manifest,
      activeScreenId: 'screen-home',
      placement,
      newNode,
      componentMeta,
    });

    expect(inserted?.insertedNodeId).toBe('text-2');
    const children = resolveActiveRootNode(inserted?.manifest ?? manifest, 'screen-home')?.children?.[0]
      ?.children;
    expect(children?.map((child) => child.id)).toEqual(['text-1', 'text-2', 'button-1']);

    const moved = moveStudioManifestNodeToPlacement({
      manifest: inserted?.manifest ?? manifest,
      activeScreenId: 'screen-home',
      nodeId: 'button-1',
      placement: { parentId: 'section-1', index: 0, kind: 'before', referenceId: 'text-1' },
      componentMeta,
    });
    const movedChildren = resolveActiveRootNode(moved?.manifest ?? manifest, 'screen-home')?.children?.[0]
      ?.children;
    expect(movedChildren?.map((child) => child.id)).toEqual(['button-1', 'text-1', 'text-2']);

    const reordered = moveStudioManifestNode(moved?.manifest ?? manifest, 'screen-home', 'text-1', 'down');
    const reorderedChildren = resolveActiveRootNode(reordered, 'screen-home')?.children?.[0]?.children;
    expect(reorderedChildren?.map((child) => child.id)).toEqual(['button-1', 'text-2', 'text-1']);
  });

  test('adds and deletes screens while keeping route state valid', () => {
    const manifest = createManifest();
    const added = addStudioManifestScreen({
      manifest,
      name: 'New Screen',
      activeScreenId: 'screen-home',
      createId: makeIdFactory(),
      screenTemplate: {
        id: 'template-root',
        type: 'Screen',
        children: [{ id: 'template-child', type: 'Text' }],
      },
    });

    expect(added.activeScreenId).toBe('screen-1');
    expect(added.manifest.screens['screen-1']?.root.id).toBe('screen-2');
    expect(added.manifest.navigator.routes.map((route) => route.name)).toEqual([
      'home',
      'about',
      'new-screen',
    ]);

    const deleted = deleteStudioManifestScreen(added.manifest, 'screen-home', 'screen-home');
    expect(deleted.activeScreenId).toBe('screen-about');
    expect(deleted.manifest.screens['screen-home']).toBeUndefined();
    expect(deleted.manifest.navigator.routes.some((route) => route.screenId === 'screen-home')).toBe(
      false,
    );
  });

  test('updates navigator, theme, module config, and OAuth provider state', () => {
    const manifest = createManifest();
    const drawer = setStudioManifestNavigatorType(manifest, 'drawer' as never);
    expect(drawer.navigator.type).toBe('drawer');

    const initialRoute = setStudioManifestNavigatorInitialRoute(drawer, 'about');
    expect(initialRoute.navigator.initialRouteName).toBe('about');

    const withTheme = addStudioManifestTheme(initialRoute, {
      id: 'theme-2',
      name: 'Theme 2',
      light: { primaryColor: '#333333', harmony: 'monochromatic' },
      dark: { primaryColor: '#444444', harmony: 'monochromatic' },
    });
    const updatedTheme = updateStudioManifestTheme(withTheme, 'theme-2', {
      name: 'Updated Theme',
      light: { primaryColor: '#555555' },
    });
    expect(updatedTheme.themes.find((theme) => theme.id === 'theme-2')?.name).toBe('Updated Theme');
    expect(updatedTheme.themes.find((theme) => theme.id === 'theme-2')?.light.primaryColor).toBe(
      '#555555',
    );

    const localization = updateStudioManifestModuleConfig(updatedTheme, 'expo-localization', {
      defaultLocale: 'de',
      locales: ['de', 'en'],
    });
    expect(localization.settings.localization.defaultLocale).toBe('de');
    expect(localization.settings.localization.locales).toEqual(['de', 'en']);

    const oauth = updateStudioManifestOAuthProviders(localization, [
      { id: 'github', provider: 'github', label: 'GitHub', enabled: true },
    ] as never);
    expect(oauth.infra.auth?.oauth?.enabled).toBe(true);
    expect(oauth.infra.auth?.oauth?.providers).toHaveLength(1);
  });
});
