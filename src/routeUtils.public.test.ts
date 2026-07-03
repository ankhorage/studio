import type { NavigatorSpec, RouteDefinition } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import type { ScreenRouteEntry, ScreenRouteGroup } from './routeUtils';
import {
  collectScreenRouteEntries,
  findNavigatorAtPath,
  findParentPathForScreenId,
  findRoutesAtParentPath,
  getPrimaryNavigatorPath,
  groupScreenRouteEntries,
  insertRouteAtParentPath,
  isRouteGroupSegment,
  listScreenIdsInRouteOrder,
  makeUniqueRouteNameForParent,
  makeUniqueSiblingRouteName,
  pathToKey,
  removeScreenIdFromRoutes,
  toCanonicalRoutePattern,
  updateNavigatorAtPath,
} from './routeUtils';

function buildRoutes(): RouteDefinition[] {
  return [
    {
      name: '(app)',
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

describe('routeUtils public exports', () => {
  test('uses the route lookup and grouping exports', () => {
    const routes = buildRoutes();
    const entries: ScreenRouteEntry[] = collectScreenRouteEntries(routes);
    const groups: ScreenRouteGroup[] = groupScreenRouteEntries(entries);

    expect(pathToKey([])).toBe('__root__');
    expect(isRouteGroupSegment('(app)')).toBe(true);
    expect(entries.map((entry) => entry.screenId)).toEqual([
      'screen-home',
      'screen-details',
      'screen-cart',
      'screen-profile',
    ]);
    expect(groups.map((group) => group.id)).toEqual(['(app)', '__root__']);
    expect(listScreenIdsInRouteOrder(routes)).toEqual([
      'screen-home',
      'screen-details',
      'screen-cart',
      'screen-profile',
    ]);
    expect(findParentPathForScreenId(routes, 'screen-details')).toEqual(['(app)']);
    expect(findRoutesAtParentPath(routes, ['(app)'])?.map((route) => route.name)).toEqual([
      'index',
      'details',
    ]);
    expect(getPrimaryNavigatorPath(routes)).toEqual(['(app)']);
  });

  test('uses navigator update exports', () => {
    const navigator: NavigatorSpec = { type: 'tabs', routes: buildRoutes() };
    const nested = findNavigatorAtPath(navigator, ['(app)']);
    const updated = updateNavigatorAtPath(navigator, ['(app)'], (current) => ({
      ...current,
      initialRouteName: 'details',
    }));

    expect(nested?.type).toBe('stack');
    expect(findNavigatorAtPath(updated, ['(app)'])?.initialRouteName).toBe('details');
  });

  test('uses route mutation and naming exports', () => {
    const routes = buildRoutes();
    const inserted = insertRouteAtParentPath(routes, ['(app)'], {
      name: 'search',
      screenId: 'screen-search',
    });
    const removed = removeScreenIdFromRoutes(inserted, 'screen-details');

    expect(findRoutesAtParentPath(inserted, ['(app)'])?.map((route) => route.name)).toEqual([
      'index',
      'details',
      'search',
    ]);
    expect(listScreenIdsInRouteOrder(removed)).toEqual([
      'screen-home',
      'screen-search',
      'screen-cart',
      'screen-profile',
    ]);
    expect(makeUniqueSiblingRouteName('screen', [{ name: 'screen' }, { name: 'screen-2' }])).toBe(
      'screen-3',
    );
    expect(toCanonicalRoutePattern(['(app)', 'shop', 'index'])).toBe('/shop');
    expect(
      makeUniqueRouteNameForParent('shop', [{ name: 'shop' }], ['(app)'], new Set(['/shop'])),
    ).toBe('shop-2');
  });
});
