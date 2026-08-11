import type { AppManifest, NavigatorSpec, RouteDefinition } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import {
  collectScreenRouteEntries,
  listScreenIdsInRouteOrder,
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
    expect(resolveScreenIdForPathname(navigator, '/scan/?source=camera#result')).toBe(
      'screen-scan',
    );
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
    expect(resolveScreenIdForPathname(navigator, '/account/settings#security')).toBe(
      'screen-account-settings',
    );
  });

  test('prefers static, dynamic, and catch-all routes in specificity order', () => {
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
              { name: 'index', screenId: 'screen-products' },
              { name: '[...slug]', screenId: 'screen-products-catch-all' },
              { name: '[id]', screenId: 'screen-product-detail' },
              { name: 'create', screenId: 'screen-product-create' },
            ],
          },
        },
        {
          name: 'docs',
          navigator: {
            type: 'stack',
            routes: [{ name: '[[...parts]]', screenId: 'screen-docs' }],
          },
        },
        {
          name: 'files',
          navigator: {
            type: 'stack',
            routes: [{ name: '[...path]', screenId: 'screen-files' }],
          },
        },
      ],
    } satisfies NavigatorSpec;

    expect(resolveScreenIdForPathname(navigator, '/')).toBe('screen-products');
    expect(resolveScreenIdForPathname(navigator, '/products')).toBe('screen-products');
    expect(resolveScreenIdForPathname(navigator, '/products/create')).toBe('screen-product-create');
    expect(resolveScreenIdForPathname(navigator, '/products/abc')).toBe('screen-product-detail');
    expect(resolveScreenIdForPathname(navigator, '/products/abc/history')).toBe(
      'screen-products-catch-all',
    );
    expect(resolveScreenIdForPathname(navigator, '/files')).toBeNull();
    expect(resolveScreenIdForPathname(navigator, '/files/a')).toBe('screen-files');
    expect(resolveScreenIdForPathname(navigator, '/docs')).toBe('screen-docs');
    expect(resolveScreenIdForPathname(navigator, '/docs/guides/start')).toBe('screen-docs');
    expect(resolveScreenIdForPathname(navigator, '/unknown')).toBeNull();
  });

  test('uses the canonical initial leaf and skips screens missing from the registry', () => {
    const navigator = {
      type: 'tabs',
      initialRouteName: 'profile',
      routes: [
        { name: 'home', screenId: 'screen-home' },
        { name: 'profile', screenId: 'screen-missing' },
        { name: 'settings', screenId: 'screen-settings' },
      ],
    } satisfies NavigatorSpec;
    const screens = {
      'screen-home': {
        id: 'screen-home',
        name: 'Home',
        root: { id: 'screen-home-root', type: 'Screen' },
      },
      'screen-settings': {
        id: 'screen-settings',
        name: 'Settings',
        root: { id: 'screen-settings-root', type: 'Screen' },
      },
    } satisfies AppManifest['screens'];

    expect(resolveScreenIdForPathname(navigator, '/', screens)).toBe('screen-home');
    expect(resolveScreenIdForPathname(navigator, '/profile', screens)).toBeNull();
  });

  test('rejects pathname identity resolution for a mismatched screen registry', () => {
    const navigator = {
      type: 'stack',
      routes: [{ name: 'home', screenId: 'registry-home' }],
    } satisfies NavigatorSpec;
    const screens = {
      'registry-home': {
        id: 'stable-home',
        name: 'Home',
        root: { id: 'home-root', type: 'Screen' },
      },
    } satisfies AppManifest['screens'];

    expect(resolveScreenIdForPathname(navigator, '/home', screens)).toBeNull();
    expect(resolveScreenIdForPathname(navigator, '/', screens)).toBeNull();
  });
});
