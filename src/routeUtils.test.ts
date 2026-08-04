import type { NavigatorSpec, RouteDefinition } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import {
  collectScreenRouteEntries,
  findRoutesAtParentPath,
  listScreenIdsInRouteOrder,
  reorderLeafRoutesWithinParent,
  resolveScreenIdForPathname,
} from './routeUtils';

function buildRoutes(): RouteDefinition[] {
  return [
    {
      name: 'home',
      navigator: {
        type: 'stack',
        initialRouteName: 'index',
        routes: [
          { name: 'index', screenId: 'screen-home' },
          { name: 'details', screenId: 'screen-details' },
        ],
      },
    },
    { name: 'cart', screenId: 'screen-cart' },
    { name: 'profile', screenId: 'screen-profile' },
  ];
}

describe('routeUtils', () => {
  test('re-exports route collection helpers', () => {
    const entries = collectScreenRouteEntries(buildRoutes());

    expect(entries.map((entry) => entry.screenId)).toEqual([
      'screen-home',
      'screen-details',
      'screen-cart',
      'screen-profile',
    ]);
    expect(listScreenIdsInRouteOrder(buildRoutes())).toEqual([
      'screen-home',
      'screen-details',
      'screen-cart',
      'screen-profile',
    ]);
  });

  test('reorders leaf routes at the root parent', () => {
    const routes = buildRoutes();
    const rootReordered = reorderLeafRoutesWithinParent(routes, [], ['profile', 'cart']);

    expect(rootReordered.map((route) => route.name)).toEqual(['home', 'profile', 'cart']);
  });

  test('reorders leaf routes only within a selected nested parent', () => {
    const routes = buildRoutes();
    const nestedReordered = reorderLeafRoutesWithinParent(routes, ['home'], ['details', 'index']);
    const nested = findRoutesAtParentPath(nestedReordered, ['home']) ?? [];

    expect(nested.map((route) => route.name)).toEqual(['details', 'index']);
    expect(rootRouteNames(nestedReordered)).toEqual(['home', 'cart', 'profile']);
  });

  test('resolves flat navigator screens from normalized pathnames', () => {
    const navigator = {
      type: 'stack',
      initialRouteName: 'index',
      routes: [
        { name: 'index', screenId: 'screen-home' },
        { name: 'scan', screenId: 'screen-scan' },
      ],
    } satisfies NavigatorSpec;

    expect(resolveScreenIdForPathname(navigator, '/')).toBe('screen-home');
    expect(resolveScreenIdForPathname(navigator, '/scan/')).toBe('screen-scan');
    expect(resolveScreenIdForPathname(navigator, '/missing')).toBeNull();
  });

  test('resolves nested Tabs to Stack initial and explicit child routes', () => {
    const navigator = {
      type: 'tabs',
      initialRouteName: 'products',
      routes: [
        {
          name: 'products',
          navigator: {
            type: 'stack',
            initialRouteName: 'index',
            routes: [
              { name: 'index', screenId: 'screen-catalog' },
              { name: '[id]', screenId: 'screen-detail' },
              { name: 'create', screenId: 'screen-create' },
            ],
          },
        },
        { name: 'scan', screenId: 'screen-scan' },
      ],
    } satisfies NavigatorSpec;

    expect(resolveScreenIdForPathname(navigator, '/products')).toBe('screen-catalog');
    expect(resolveScreenIdForPathname(navigator, '/')).toBe('screen-catalog');
    expect(resolveScreenIdForPathname(navigator, '/products/create')).toBe('screen-create');
    expect(resolveScreenIdForPathname(navigator, '/products/product-42')).toBe('screen-detail');
    expect(resolveScreenIdForPathname(navigator, '/scan')).toBe('screen-scan');
  });

  test('resolves route groups and nested Drawer to Stack screens recursively', () => {
    const navigator = {
      type: 'stack',
      routes: [
        {
          name: '(app)',
          navigator: {
            type: 'drawer',
            routes: [
              {
                name: 'account',
                navigator: {
                  type: 'stack',
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
    } satisfies NavigatorSpec;

    expect(resolveScreenIdForPathname(navigator, '/account')).toBe('screen-account');
    expect(resolveScreenIdForPathname(navigator, '/account/settings?panel=profile')).toBe(
      'screen-account-settings',
    );
  });
});

function rootRouteNames(routes: RouteDefinition[]): string[] {
  return routes.map((route) => route.name);
}
