import type { RouteDefinition } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import {
  collectScreenRouteEntries,
  findRoutesAtParentPath,
  listScreenIdsInRouteOrder,
  reorderLeafRoutesWithinParent,
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
});

function rootRouteNames(routes: RouteDefinition[]): string[] {
  return routes.map((route) => route.name);
}
