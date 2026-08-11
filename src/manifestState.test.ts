import type { UiNode } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import type { NodePlacement, StudioComponentMetaRegistry, StudioManifest } from './index';
import {
  addStudioManifestScreen,
  addStudioManifestTheme,
  createStudioManifestFingerprint,
  deleteStudioManifestNode,
  deleteStudioManifestScreen,
  insertStudioManifestNodeAtPlacement,
  moveStudioManifestNodeToPlacement,
  resolveActiveRootNode,
  resolveInitialActiveScreenId,
  resolveInitialScreenId,
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
  Section: { category: 'layout', allowedChildren: ['Text', 'Button'], directManifestNode: true },
  Text: { category: 'component', allowedChildren: [], directManifestNode: true },
  Button: { category: 'component', allowedChildren: [], directManifestNode: true },
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
        root: { id: 'root-about', type: 'Screen', children: [] },
      },
    },
    dataBindings: { 'text-1': { sourceId: 'source-1', path: 'title' } },
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
    settings: { localization: { defaultLocale: 'en', locales: ['en'] } },
    infra: { modulesConfig: {} },
  } as unknown as StudioManifest;
}

function createScreens(...screenIds: string[]): StudioManifest['screens'] {
  return Object.fromEntries(
    screenIds.map((screenId) => [
      screenId,
      {
        id: screenId,
        name: screenId,
        root: { id: `${screenId}-root`, type: 'Screen', children: [] },
      },
    ]),
  );
}

describe('manifestState', () => {
  test('resolves root and selected node state', () => {
    const manifest = createManifest();
    const root = resolveActiveRootNode(manifest, 'screen-home');

    expect(resolveInitialActiveScreenId(manifest)).toBe('screen-home');
    expect(root?.id).toBe('root-home');
    expect(resolveSafeSelectedNodeId(root, 'text-1')).toBe('text-1');
    expect(resolveSafeSelectedNodeId(root, 'missing')).toBe(null);
  });

  test('respects a flat navigator initial route that is not first', () => {
    const manifest = createManifest();
    manifest.navigator.initialRouteName = 'about';

    expect(resolveInitialScreenId(manifest.navigator, manifest.screens)).toBe('screen-about');
    expect(resolveInitialActiveScreenId(manifest)).toBe('screen-about');
  });

  test('follows a nested Tabs to Stack initial-route chain', () => {
    const navigator: StudioManifest['navigator'] = {
      type: 'tabs',
      initialRouteName: 'products',
      routes: [
        { name: 'home', screenId: 'screen-home' },
        {
          name: 'products',
          navigator: {
            type: 'stack',
            initialRouteName: 'index',
            routes: [
              { name: 'create', screenId: 'screen-create' },
              { name: 'index', screenId: 'screen-catalog' },
            ],
          },
        },
      ],
    };

    expect(
      resolveInitialScreenId(
        navigator,
        createScreens('screen-home', 'screen-create', 'screen-catalog'),
      ),
    ).toBe('screen-catalog');
  });

  test('follows route-group, Drawer, and Stack initial routes recursively', () => {
    const navigator: StudioManifest['navigator'] = {
      type: 'stack',
      initialRouteName: '(app)',
      routes: [
        { name: 'landing', screenId: 'screen-landing' },
        {
          name: '(app)',
          navigator: {
            type: 'drawer',
            initialRouteName: 'account',
            routes: [
              { name: 'dashboard', screenId: 'screen-dashboard' },
              {
                name: 'account',
                navigator: {
                  type: 'stack',
                  initialRouteName: 'settings',
                  routes: [
                    { name: 'index', screenId: 'screen-account' },
                    { name: 'settings', screenId: 'screen-account-settings' },
                  ],
                },
              },
            ],
          },
        },
      ],
    };

    expect(
      resolveInitialScreenId(
        navigator,
        createScreens(
          'screen-landing',
          'screen-dashboard',
          'screen-account',
          'screen-account-settings',
        ),
      ),
    ).toBe('screen-account-settings');
  });

  test('falls back to the first valid route when the initial route is absent or invalid', () => {
    const screens = createScreens('screen-home', 'screen-profile');
    const routes: StudioManifest['navigator']['routes'] = [
      { name: 'home', screenId: 'screen-home' },
      { name: 'profile', screenId: 'screen-profile' },
    ];

    expect(resolveInitialScreenId({ type: 'stack', routes }, screens)).toBe('screen-home');
    expect(
      resolveInitialScreenId({ type: 'drawer', initialRouteName: 'missing', routes }, screens),
    ).toBe('screen-home');
  });

  test('skips unusable initial routes and falls back to the first valid routed screen', () => {
    const navigator: StudioManifest['navigator'] = {
      type: 'tabs',
      initialRouteName: 'broken',
      routes: [
        {
          name: 'broken',
          screenId: 'screen-missing',
          navigator: { type: 'stack', routes: [] },
        },
        {
          name: 'account',
          navigator: {
            type: 'stack',
            routes: [
              { name: 'missing', screenId: 'screen-also-missing' },
              { name: 'settings', screenId: 'screen-settings' },
            ],
          },
        },
      ],
    };

    expect(resolveInitialScreenId(navigator, createScreens('screen-settings'))).toBe(
      'screen-settings',
    );
  });

  test('returns null for an empty navigator', () => {
    expect(resolveInitialScreenId({ type: 'stack', routes: [] }, createScreens())).toBeNull();
  });

  test('retains the canonical initial app screen for direct Studio admin entry', () => {
    const manifest = createManifest();
    manifest.navigator.initialRouteName = 'about';

    // StudioProvider uses this pure fallback when activePathname is undefined on /ankh routes.
    expect(resolveInitialActiveScreenId(manifest)).toBe('screen-about');
  });

  test('creates fingerprints from tracked manifest fields', () => {
    const first = createManifest();
    const second = {
      ...first,
      generatedApis: {
        probe: {
          id: 'probe',
          protocol: 'rest',
          basePath: '/api/probe',
          database: { id: 'primary-db', kind: 'database' },
          resources: [],
        },
      },
    } as StudioManifest;

    expect(createStudioManifestFingerprint(first)).not.toBe(
      createStudioManifestFingerprint(second),
    );
  });

  test('updates, inserts, deletes, and moves nodes', () => {
    const manifest = createManifest();
    const updated = updateStudioManifestNode(manifest, 'screen-home', 'text-1', {
      children: 'Updated',
      alias: 'Hero copy',
    });
    expect(resolveActiveRootNode(updated, 'screen-home')?.children?.[0]?.children?.[0]?.alias).toBe(
      'Hero copy',
    );

    const newNode: UiNode = { id: 'text-2', type: 'Text', props: { children: 'Inserted' } };
    const placement: NodePlacement = { parentId: 'section-1', index: 1, kind: 'inside' };
    const inserted = insertStudioManifestNodeAtPlacement({
      manifest: updated,
      activeScreenId: 'screen-home',
      placement,
      newNode,
      componentMeta,
    });
    expect(inserted?.insertedNodeId).toBe('text-2');

    const moved = moveStudioManifestNodeToPlacement({
      manifest: inserted?.manifest ?? updated,
      activeScreenId: 'screen-home',
      nodeId: 'button-1',
      placement: { parentId: 'section-1', index: 0, kind: 'before', referenceId: 'text-1' },
      componentMeta,
    });
    expect(moved?.movedNodeId).toBe('button-1');

    const deleted = deleteStudioManifestNode(
      moved?.manifest ?? updated,
      'screen-home',
      'text-1',
    );
    expect(JSON.stringify(resolveActiveRootNode(deleted, 'screen-home'))).not.toContain('text-1');
    expect(deleted.dataBindings?.['text-1']).toBeUndefined();
  });

  test('adds and deletes screens', () => {
    let idIndex = 0;
    const createId = (prefix = 'id') => {
      idIndex += 1;
      return `${prefix.toLowerCase()}-${idIndex}`;
    };
    const manifest = createManifest();
    const added = addStudioManifestScreen({
      manifest,
      name: 'New Screen',
      activeScreenId: 'screen-home',
      createId,
    });

    expect(added.activeScreenId).toBe('screen-1');
    expect(added.manifest.navigator.routes.map((route) => route.name)).toEqual([
      'home',
      'about',
      'new-screen',
    ]);

    const deleted = deleteStudioManifestScreen(added.manifest, 'screen-home', 'screen-home');
    expect(deleted.activeScreenId).toBe('screen-about');
    expect(deleted.manifest.screens['screen-home']).toBeUndefined();
  });

  test('updates navigator, theme, module config, and OAuth providers', () => {
    const manifest = createManifest();
    const drawer = setStudioManifestNavigatorType(manifest, 'drawer');
    const initialRoute = setStudioManifestNavigatorInitialRoute(drawer, 'about');
    const withTheme = addStudioManifestTheme(initialRoute, {
      id: 'theme-2',
      name: 'Theme 2',
      light: { primaryColor: '#333333', harmony: 'monochromatic' },
      dark: { primaryColor: '#444444', harmony: 'monochromatic' },
    });
    const themed = updateStudioManifestTheme(withTheme, 'theme-2', {
      name: 'Updated Theme',
      light: { primaryColor: '#555555' },
    });
    const localized = updateStudioManifestModuleConfig(themed, 'expo-localization', {
      defaultLocale: 'de',
      locales: ['de', 'en'],
    });
    const oauth = updateStudioManifestOAuthProviders(localized, [
      { id: 'github', provider: 'github', label: 'GitHub', enabled: true },
    ] as never);

    expect(oauth.navigator.type).toBe('drawer');
    expect(oauth.navigator.initialRouteName).toBe('about');
    expect(oauth.themes.find((theme) => theme.id === 'theme-2')?.name).toBe('Updated Theme');
    expect(oauth.settings.localization.defaultLocale).toBe('de');
    expect(oauth.infra.auth?.oauth?.providers).toHaveLength(1);
  });
});
