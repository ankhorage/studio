import { describe, expect, test } from 'bun:test';

import {
  createStudioAdminRouteRenderState,
  createStudioPropertiesRoutePath,
  openStudioAdminRoute,
  resolveStudioAdminRoutePath,
  resolveStudioPropertiesNodeId,
} from './studioAdminRouteModel';

describe('studioAdminRouteModel', () => {
  test('resolves admin route paths', () => {
    expect(resolveStudioAdminRoutePath('/ankh/apis')).toBe('/ankh/apis');
    expect(resolveStudioAdminRoutePath('/ankh/properties/node-1')).toBe('/ankh/properties');
    expect(resolveStudioAdminRoutePath('/app')).toBeNull();
  });

  test('resolves properties node ids', () => {
    expect(resolveStudioPropertiesNodeId('/ankh/properties/node-1')).toBe('node-1');
    expect(resolveStudioPropertiesNodeId('/ankh/properties/node%201')).toBe('node 1');
    expect(resolveStudioPropertiesNodeId('/ankh/apis')).toBeNull();
  });

  test('creates render state', () => {
    expect(
      createStudioAdminRouteRenderState({
        pathname: '/ankh/auth',
        activeAdminRoutePath: '/',
      }),
    ).toEqual({
      routeAdminPath: '/ankh/auth',
      resolvedAdminRoutePath: '/ankh/auth',
      propertiesNodeId: null,
      shouldRenderAppContent: true,
      shouldRenderAdminOverlay: true,
    });
  });

  test('creates properties route paths and opens admin routes', () => {
    expect(createStudioPropertiesRoutePath('node 1')).toBe('/ankh/properties/node%201');

    const panelIds: (string | null)[] = [];
    const routes: string[] = [];
    openStudioAdminRoute({
      next: '/ankh/theme',
      setActivePanelId: (panelId) => panelIds.push(panelId),
      pushRoute: (routePath) => routes.push(routePath),
    });

    expect(panelIds).toEqual([null]);
    expect(routes).toEqual(['/ankh/theme']);
  });
});
