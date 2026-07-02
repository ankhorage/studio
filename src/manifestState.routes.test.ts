import { describe, expect, test } from 'bun:test';

import type { StudioManifest } from './index';
import { findScreenIdForNode, listScreenIdsInRouteOrder } from './manifestState';

const manifest = {
  navigator: {
    type: 'tabs',
    routes: [{ name: 'home', screenId: 'home-screen' }],
  },
  screens: {
    'home-screen': {
      root: {
        id: 'root',
        type: 'Screen',
        children: [{ id: 'child', type: 'Text' }],
      },
    },
  },
} as unknown as StudioManifest;

describe('manifestState route exports', () => {
  test('uses the routed screen and node lookup helpers', () => {
    expect(listScreenIdsInRouteOrder(manifest.navigator.routes)).toEqual(['home-screen']);
    expect(findScreenIdForNode(manifest, 'child')).toBe('home-screen');
  });
});
