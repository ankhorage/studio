import type { RouteDefinition } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import type { StudioManifest } from './index';
import {
  collectScreenRouteEntries,
  createDefaultThemeConfig,
  DEFAULT_STUDIO_SCREEN_TEMPLATE,
  deleteStudioManifestTheme,
  findNavigatorAtPath,
  findNodeInManifest,
  findParentPathForScreenId,
  findRoutesAtParentPath,
  generateManifestStateId,
  getPrimaryNavigatorPath,
  groupScreenRouteEntries,
  insertRouteAtParentPath,
  isRouteGroupSegment,
  makeUniqueRouteNameForParent,
  makeUniqueSiblingRouteName,
  pathToKey,
  removeScreenIdFromRoutes,
  reorderStudioManifestScreens,
  type ScreenRouteEntry,
  type ScreenRouteGroup,
  setStudioManifestActiveThemeId,
  setStudioManifestActiveThemeMode,
  toCanonicalRoutePattern,
  updateNavigatorAtPath,
  updateStudioManifestAppData,
  updateStudioManifestDataBindings,
  updateStudioManifestDataSources,
} from './manifestState';

const routes: RouteDefinition[] = [
  {
    name: '(app)',
    label: 'App',
    navigator: {
      type: 'tabs',
      initialRouteName: 'index',
      routes: [
        { name: 'index', label: 'Home', screenId: 'screen-home' },
        { name: 'settings', label: 'Settings', screenId: 'screen-settings' },
      ],
    },
  },
  { name: 'auth', label: 'Auth', screenId: 'screen-auth' },
];

function createManifest(): StudioManifest {
  return {
    navigator: { type: 'tabs', routes },
    screens: {
      'screen-home': {
        id: 'screen-home',
        name: 'Home',
        title: 'Home',
        root: {
          id: 'root-home',
          type: 'Screen',
          children: [{ id: 'text-1', type: 'Text', props: { children: 'Home' } }],
        },
      },
    },
    data: {},
    dataBindings: {},
    dataSources: {},
    themes: [createDefaultThemeConfig(0, 'theme-1'), createDefaultThemeConfig(1, 'theme-2')],
    activeThemeId: 'theme-2',
    activeThemeMode: 'light',
    settings: { localization: { defaultLocale: 'en', locales: ['en'] } },
    infra: { modulesConfig: {} },
  } as unknown as StudioManifest;
}

describe('manifestState public surface', () => {
  test('exports template and id helpers', () => {
    expect(DEFAULT_STUDIO_SCREEN_TEMPLATE.type).toBe('Screen');
    expect(generateManifestStateId('Node').startsWith('node-')).toBe(true);
    expect(createDefaultThemeConfig(2, 'theme-fixed').id).toBe('theme-fixed');
  });

  test('exports route tree helpers', () => {
    const entries: ScreenRouteEntry[] = collectScreenRouteEntries(routes);
    const groups: ScreenRouteGroup[] = groupScreenRouteEntries(entries);
    const rootNavigator = { type: 'stack', routes } as const;
    const insertedRoutes = insertRouteAtParentPath(routes, ['(app)'], {
      name: 'profile',
      label: 'Profile',
      screenId: 'screen-profile',
    });
    const updatedNavigator = updateNavigatorAtPath(rootNavigator, ['(app)'], (current) => ({
      ...current,
      initialRouteName: 'settings',
    }));

    expect(pathToKey([])).toBe('__root__');
    expect(pathToKey(['(app)'])).toBe('(app)');
    expect(isRouteGroupSegment('(app)')).toBe(true);
    expect(entries.map((entry) => entry.screenId)).toEqual([
      'screen-home',
      'screen-settings',
      'screen-auth',
    ]);
    expect(groups.find((group) => group.id === '(app)')?.entries).toHaveLength(2);
    expect(getPrimaryNavigatorPath(routes)).toEqual(['(app)']);
    expect(findParentPathForScreenId(routes, 'screen-settings')).toEqual(['(app)']);
    expect(findRoutesAtParentPath(routes, ['(app)'])?.map((route) => route.name)).toEqual([
      'index',
      'settings',
    ]);
    expect(findRoutesAtParentPath(insertedRoutes, ['(app)'])?.map((route) => route.name)).toEqual([
      'index',
      'settings',
      'profile',
    ]);
    expect(findNavigatorAtPath(rootNavigator, ['(app)'])?.type).toBe('tabs');
    expect(findNavigatorAtPath(updatedNavigator, ['(app)'])?.initialRouteName).toBe('settings');
    expect(JSON.stringify(removeScreenIdFromRoutes(routes, 'screen-settings'))).not.toContain(
      'screen-settings',
    );
    expect(makeUniqueSiblingRouteName('settings', [{ name: 'settings', screenId: 'x' }])).toBe(
      'settings-2',
    );
    expect(toCanonicalRoutePattern(['(app)', 'index'])).toBe('/');
    expect(
      makeUniqueRouteNameForParent(
        'settings',
        [{ name: 'settings', screenId: 'screen-settings' }],
        ['(app)'],
        new Set(['/settings', '/settings-2']),
      ),
    ).toBe('settings-3');
  });

  test('exports manifest and node helpers', () => {
    const manifest = createManifest();
    const rootNode = manifest.screens['screen-home']?.root;
    if (!rootNode) throw new Error('Expected screen-home root node.');

    const appData = { collections: {} } as never;
    const dataBindings = {
      'text-1': { sourceId: 'source-1', path: '$.title' },
    } as never;
    const dataSources = {
      'source-1': { id: 'source-1', type: 'static', config: {} },
    } as never;
    const reordered = reorderStudioManifestScreens(
      manifest,
      [...manifest.navigator.routes].reverse(),
    );
    const withData = updateStudioManifestAppData(manifest, appData);
    const withBindings = updateStudioManifestDataBindings(withData, dataBindings);
    const withSources = updateStudioManifestDataSources(withBindings, dataSources);
    const activeTheme = setStudioManifestActiveThemeId(withSources, 'theme-1');
    const darkTheme = setStudioManifestActiveThemeMode(activeTheme, 'dark');
    const deletedTheme = deleteStudioManifestTheme(darkTheme, 'theme-1');

    expect(findNodeInManifest(rootNode, 'text-1')?.id).toBe('text-1');
    expect(reordered.navigator.routes.map((route) => route.name)).toEqual(['auth', '(app)']);
    expect(withData.data).toBe(appData);
    expect(withBindings.dataBindings).toBe(dataBindings);
    expect(withSources.dataSources).toBe(dataSources);
    expect(darkTheme.activeThemeMode).toBe('dark');
    expect(deletedTheme.activeThemeId).toBe('theme-2');
  });
});
