import type { UiNode } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import type { NodePlacement, StudioComponentMetaRegistry, StudioManifest } from './index';
import {
  addStudioManifestScreen,
  addStudioManifestTheme,
  createStudioManifestFingerprint,
  deleteStudioManifestNode,
  deleteStudioManifestScreen,
  deriveStudioScreenNavigationModel,
  findRoutesAtParentPath,
  hasCanonicalStudioScreenRegistryIdentity,
  insertStudioManifestNodeAtPlacement,
  moveStudioManifestNodeToPlacement,
  moveStudioManifestRoute,
  resolveActiveRootNode,
  resolveInitialActiveScreenId,
  resolveInitialScreenId,
  resolveSafeSelectedNodeId,
  resolveStudioScreenAppPath,
  setStudioManifestNavigatorInitialRoute,
  setStudioManifestNavigatorType,
  setStudioManifestRoutePrimaryNavigationVisibility,
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

    const deleted = deleteStudioManifestNode(moved?.manifest ?? updated, 'screen-home', 'text-1');
    expect(JSON.stringify(resolveActiveRootNode(deleted, 'screen-home'))).not.toContain('text-1');
    expect(deleted.dataBindings?.['text-1']).toBeUndefined();
  });

  test('protects roots and removes bindings owned by an entire deleted subtree', () => {
    const manifest = createManifest();
    const rootProtected = deleteStudioManifestNode(manifest, 'screen-home', 'root-home');
    expect(rootProtected).toBe(manifest);

    const deleted = deleteStudioManifestNode(manifest, 'screen-home', 'section-1');
    expect(resolveActiveRootNode(deleted, 'screen-home')?.children).toEqual([]);
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

  test('derives nested route references, primary membership, paths, and unrouted screens', () => {
    const manifest = createManifest();
    manifest.screens['screen-unrouted'] = {
      id: 'screen-unrouted',
      name: 'Unrouted',
      root: { id: 'root-unrouted', type: 'Screen', children: [] },
    };
    manifest.navigator = {
      type: 'stack',
      initialRouteName: '(app)',
      routes: [
        {
          name: '(app)',
          navigator: {
            type: 'drawer',
            initialRouteName: 'home',
            routes: [
              {
                name: 'home',
                screenId: 'screen-home',
                showInPrimaryNavigation: false,
              },
              {
                name: 'account',
                navigator: {
                  type: 'stack',
                  routes: [{ name: '[id]', path: 'profile/:id', screenId: 'screen-about' }],
                },
              },
            ],
          },
        },
      ],
    };

    const model = deriveStudioScreenNavigationModel(manifest);
    const home = model.screens.find((entry) => entry.screenId === 'screen-home');
    const about = model.screens.find((entry) => entry.screenId === 'screen-about');
    const unrouted = model.screens.find((entry) => entry.screenId === 'screen-unrouted');

    expect(model.primaryNavigatorPath).toEqual(['(app)']);
    expect(model.primaryNavigator.type).toBe('drawer');
    expect(home?.routeReferences[0]).toMatchObject({
      parentPath: ['(app)'],
      routePath: ['(app)', 'home'],
      pathnamePattern: '/home',
      isPrimaryNavigatorMember: true,
      showInPrimaryNavigation: false,
      isPrimaryInitialRoute: true,
      siblingIndex: 0,
    });
    expect(about?.routeReferences[0]).toMatchObject({
      parentPath: ['(app)', 'account'],
      routePath: ['(app)', 'account', '[id]'],
      pathnamePattern: '/account/profile/:id',
      isPrimaryNavigatorMember: false,
      siblingIndex: 0,
    });
    expect(unrouted?.routeReferences).toEqual([]);
    expect(model.diagnostics).toEqual([]);
  });

  test('resolves an app pathname only for one concrete canonical route reference', () => {
    const manifest = createManifest();
    let model = deriveStudioScreenNavigationModel(manifest);
    const home = model.screens.find((entry) => entry.screenId === 'screen-home');
    expect(resolveStudioScreenAppPath(model, home?.screenId ?? '')).toBe('/home');

    manifest.navigator.routes.push({ name: 'home-alias', screenId: 'screen-home' });
    model = deriveStudioScreenNavigationModel(manifest);
    const ambiguousHome = model.screens.find((entry) => entry.screenId === 'screen-home');
    expect(resolveStudioScreenAppPath(model, ambiguousHome?.screenId ?? '')).toBeNull();

    manifest.navigator.routes = [{ name: '[id]', path: 'products/:id', screenId: 'screen-home' }];
    model = deriveStudioScreenNavigationModel(manifest);
    const dynamicHome = model.screens.find((entry) => entry.screenId === 'screen-home');
    expect(resolveStudioScreenAppPath(model, dynamicHome?.screenId ?? '')).toBeNull();

    manifest.navigator.routes = [
      { name: 'home', path: '/shared', screenId: 'screen-home' },
      { name: 'about', path: '/shared', screenId: 'screen-about' },
    ];
    model = deriveStudioScreenNavigationModel(manifest);
    expect(resolveStudioScreenAppPath(model, 'screen-home')).toBeNull();
  });

  test('uses ScreenSpec.id as Studio identity while diagnosing mismatched registry keys', () => {
    const manifest = createManifest();
    const home = manifest.screens['screen-home'];
    const about = manifest.screens['screen-about'];
    if (!home || !about) throw new Error('Expected canonical fixture screens.');

    manifest.screens = {
      'registry-home': { ...home, id: 'stable-home' },
      'registry-about': { ...about, id: 'stable-about' },
    };
    manifest.navigator.routes = [
      { name: 'home', screenId: 'registry-home' },
      { name: 'about', screenId: 'registry-about' },
    ];

    const model = deriveStudioScreenNavigationModel(manifest);

    expect(model.screens.map(({ screenId }) => screenId)).toEqual(['stable-home', 'stable-about']);
    expect(model.screens[0]?.routeReferences[0]).toMatchObject({
      pathnamePattern: '/home',
      route: { screenId: 'registry-home' },
    });
    expect(resolveStudioScreenAppPath(model, 'stable-home')).toBe('/home');
    expect(resolveStudioScreenAppPath(model, 'registry-home')).toBeNull();
    expect(model.diagnostics.map(({ code, screenId }) => ({ code, screenId }))).toEqual([
      { code: 'screen-registry-key-mismatch', screenId: 'stable-home' },
      { code: 'screen-registry-key-mismatch', screenId: 'stable-about' },
    ]);
    expect(hasCanonicalStudioScreenRegistryIdentity(manifest.screens)).toBe(false);
    expect(resolveInitialActiveScreenId(manifest)).toBeNull();
    expect(resolveActiveRootNode(manifest, 'stable-home')).toBeNull();

    const added = addStudioManifestScreen({
      manifest,
      name: 'Rejected',
      activeScreenId: 'stable-home',
      createId: () => 'stable-new',
    });
    const deleted = deleteStudioManifestScreen(manifest, 'stable-home', 'stable-home');
    expect(added).toEqual({ manifest, activeScreenId: 'stable-home' });
    expect(added.manifest).toBe(manifest);
    expect(deleted).toEqual({ manifest, activeScreenId: 'stable-home' });
    expect(deleted.manifest).toBe(manifest);
  });

  test('does not resolve an arbitrary screen when stable ScreenSpec ids are duplicated', () => {
    const manifest = createManifest();
    const home = manifest.screens['screen-home'];
    const about = manifest.screens['screen-about'];
    if (!home || !about) throw new Error('Expected canonical fixture screens.');

    manifest.screens = {
      'registry-home': { ...home, id: 'duplicate-id' },
      'registry-about': { ...about, id: 'duplicate-id' },
    };
    manifest.navigator.routes = [
      { name: 'home', screenId: 'registry-home' },
      { name: 'about', screenId: 'registry-about' },
    ];

    const model = deriveStudioScreenNavigationModel(manifest);
    expect(model.screens.map(({ screenId }) => screenId)).toEqual(['duplicate-id', 'duplicate-id']);
    expect(model.diagnostics.filter(({ code }) => code === 'duplicate-screen-id')).toEqual([
      {
        code: 'duplicate-screen-id',
        message: 'Stable ScreenSpec.id "duplicate-id" is used by multiple screen registry entries.',
        parentPath: [],
        screenId: 'duplicate-id',
      },
    ]);
    expect(resolveStudioScreenAppPath(model, 'duplicate-id')).toBeNull();
  });

  test('reports malformed navigator and route references deterministically', () => {
    const manifest = createManifest();
    manifest.navigator = {
      type: 'tabs',
      initialRouteName: 'missing',
      routes: [
        { name: 'duplicate', screenId: 'screen-home' },
        { name: 'duplicate', screenId: 'screen-home' },
        { name: 'orphan', screenId: 'screen-missing' },
        { name: 'empty' },
      ],
    };

    expect(deriveStudioScreenNavigationModel(manifest).diagnostics.map(({ code }) => code)).toEqual(
      [
        'invalid-initial-route',
        'duplicate-sibling-route-name',
        'missing-screen-reference',
        'missing-route-target',
        'ambiguous-screen-route-reference',
      ],
    );
  });

  test('creates screens in the primary navigator rather than the active nested stack', () => {
    const manifest = createManifest();
    manifest.navigator = {
      type: 'stack',
      routes: [
        {
          name: '(app)',
          navigator: {
            type: 'tabs',
            routes: [
              { name: 'home', screenId: 'screen-home' },
              {
                name: 'account',
                navigator: {
                  type: 'stack',
                  routes: [{ name: 'about', screenId: 'screen-about' }],
                },
              },
            ],
          },
        },
      ],
    };
    let id = 0;
    const added = addStudioManifestScreen({
      manifest,
      name: 'Settings',
      activeScreenId: 'screen-about',
      createId: (prefix = 'id') => `${prefix.toLowerCase()}-${++id}`,
    });

    expect(
      findRoutesAtParentPath(added.manifest.navigator.routes, ['(app)'])?.at(-1),
    ).toMatchObject({ name: 'settings', screenId: 'screen-1' });
    expect(
      findRoutesAtParentPath(added.manifest.navigator.routes, ['(app)', 'account']),
    ).toHaveLength(1);
  });

  test('creates a route whose canonical path does not collide with an explicit route path', () => {
    const manifest = createManifest();
    const [, about] = manifest.navigator.routes;
    if (about) about.path = '/settings';
    let id = 0;
    const added = addStudioManifestScreen({
      manifest,
      name: 'Settings',
      activeScreenId: 'screen-home',
      createId: (prefix = 'id') => `${prefix.toLowerCase()}-${++id}`,
    });

    expect(added.manifest.navigator.routes.at(-1)?.name).toBe('settings-2');
  });

  test('deletes every route reference and subtree binding atomically', () => {
    const manifest = createManifest();
    manifest.navigator.routes.push({
      name: 'nested',
      navigator: { type: 'stack', routes: [{ name: 'home-copy', screenId: 'screen-home' }] },
    });
    manifest.dataBindings = {
      'root-home': { componentId: 'root-home', sourceId: 'source-1', path: '$' },
      'text-1': { componentId: 'text-1', sourceId: 'source-1', path: '$.title' },
      'root-about': { componentId: 'root-about', sourceId: 'source-1', path: '$' },
    } as never;

    const missing = deleteStudioManifestScreen(manifest, 'screen-missing', 'screen-home');
    expect(missing.manifest).toBe(manifest);

    const deleted = deleteStudioManifestScreen(manifest, 'screen-home', 'screen-home');
    expect(JSON.stringify(deleted.manifest.navigator)).not.toContain('screen-home');
    expect(deleted.manifest.navigator.initialRouteName).toBe('about');
    expect(deleted.manifest.dataBindings?.['root-home']).toBeUndefined();
    expect(deleted.manifest.dataBindings?.['text-1']).toBeUndefined();
    expect(deleted.manifest.dataBindings?.['root-about']).toBeDefined();
    expect(deleted.activeScreenId).toBe('screen-about');
  });

  test('refuses to delete the final screen', () => {
    const manifest = createManifest();
    delete manifest.screens['screen-about'];
    manifest.navigator.routes = [{ name: 'home', screenId: 'screen-home' }];

    expect(deleteStudioManifestScreen(manifest, 'screen-home', 'screen-home')).toEqual({
      manifest,
      activeScreenId: 'screen-home',
    });
  });

  test('updates visibility and sibling order without recreating routes or changing initial state', () => {
    const manifest = createManifest();
    const [homeRoute] = manifest.navigator.routes;
    const hidden = setStudioManifestRoutePrimaryNavigationVisibility({
      manifest,
      parentPath: [],
      routeName: 'home',
      showInPrimaryNavigation: false,
    });
    expect(hidden.navigator.routes[0]).toBeDefined();
    expect(hidden.navigator.routes[0]?.showInPrimaryNavigation).toBe(false);
    expect(hidden.navigator.initialRouteName).toBe('home');

    const moved = moveStudioManifestRoute({
      manifest: hidden,
      parentPath: [],
      routeName: 'home',
      toIndex: 1,
    });
    expect(moved.navigator.routes.map((route) => route.name)).toEqual(['about', 'home']);
    expect(moved.navigator.routes[1]).toMatchObject(homeRoute ?? {});
    expect(moved.navigator.routes[1]?.showInPrimaryNavigation).toBe(false);
    expect(moved.navigator.initialRouteName).toBe('home');

    const restoredOrder = moveStudioManifestRoute({
      manifest: moved,
      parentPath: [],
      routeName: 'home',
      toIndex: 0,
    });
    expect(restoredOrder.navigator.routes.map((route) => route.name)).toEqual(['home', 'about']);

    const drawer = setStudioManifestNavigatorType(restoredOrder, 'drawer');
    expect(drawer.navigator.routes).toBe(restoredOrder.navigator.routes);
    expect(drawer.navigator.routes[0]?.showInPrimaryNavigation).toBe(false);
    expect(drawer.navigator.initialRouteName).toBe('home');
    expect(setStudioManifestNavigatorType(drawer, 'grid' as never)).toBe(drawer);

    const hiddenInitial = setStudioManifestNavigatorInitialRoute(drawer, 'home');
    expect(hiddenInitial).toBe(drawer);
    expect(setStudioManifestNavigatorInitialRoute(drawer, 'missing')).toBe(drawer);

    const visible = setStudioManifestRoutePrimaryNavigationVisibility({
      manifest: drawer,
      parentPath: [],
      routeName: 'home',
      showInPrimaryNavigation: true,
    });
    expect('showInPrimaryNavigation' in (visible.navigator.routes[0] ?? {})).toBe(false);
    expect(
      moveStudioManifestRoute({
        manifest: visible,
        parentPath: [],
        routeName: 'home',
        toIndex: 3,
      }),
    ).toBe(visible);
  });

  test('updates navigator, theme, and OAuth providers', () => {
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
    const oauth = updateStudioManifestOAuthProviders(themed, [
      { id: 'github', provider: 'github', label: 'GitHub', enabled: true },
    ] as never);

    expect(oauth.navigator.type).toBe('drawer');
    expect(oauth.navigator.initialRouteName).toBe('about');
    expect(oauth.themes.find((theme) => theme.id === 'theme-2')?.name).toBe('Updated Theme');
    expect(oauth.infra.auth?.oauth?.providers).toHaveLength(1);
  });
});
