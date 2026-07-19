import { describe, expect, test } from 'bun:test';

import {
  createStudioAdminRoutePath,
  createStudioAdminRouteRenderState,
  createStudioPropertiesRoutePath,
  isStudioAdminRouteActive,
  isStudioAdminRouteAvailable,
  openStudioAdminRoute,
  resolveStudioAdminRouteId,
  resolveStudioAdminRoutePath,
  resolveStudioLastNonAdminLocation,
  resolveStudioNavigableLocation,
  resolveStudioPropertiesNodeId,
  STUDIO_ADMIN_ROUTE_REGISTRY,
} from './studioAdminRouteModel';

describe('studioAdminRouteModel', () => {
  test('defines every canonical admin route once', () => {
    expect(STUDIO_ADMIN_ROUTE_REGISTRY.map((route) => route.id)).toEqual([
      'overview',
      'apis',
      'api-data-sources',
      'api-operations',
      'auth',
      'auth-providers',
      'auth-routes',
      'auth-profile',
      'secrets',
      'theme',
      'properties',
    ]);
  });

  test('resolves admin route ids and concrete paths', () => {
    expect(resolveStudioAdminRouteId('/ankh')).toBe('overview');
    expect(resolveStudioAdminRouteId('/ankh/apis')).toBe('apis');
    expect(resolveStudioAdminRouteId('/ankh/apis/data-sources')).toBe('api-data-sources');
    expect(resolveStudioAdminRouteId('/ankh/apis/operations')).toBe('api-operations');
    expect(resolveStudioAdminRouteId('/ankh/auth')).toBe('auth');
    expect(resolveStudioAdminRouteId('/ankh/auth/providers')).toBe('auth-providers');
    expect(resolveStudioAdminRouteId('/ankh/auth/routes')).toBe('auth-routes');
    expect(resolveStudioAdminRouteId('/ankh/auth/profile')).toBe('auth-profile');
    expect(resolveStudioAdminRouteId('/ankh/secrets')).toBe('secrets');
    expect(resolveStudioAdminRouteId('/ankh/theme')).toBe('theme');
    expect(resolveStudioAdminRouteId('/ankh/properties/node-1')).toBe('properties');
    expect(resolveStudioAdminRoutePath('/ankh/properties/node-1')).toBe('/ankh/properties/node-1');
    expect(resolveStudioAdminRouteId('/app')).toBeNull();
  });

  test('resolves properties node ids and creates properties paths', () => {
    expect(resolveStudioPropertiesNodeId('/ankh/properties/node-1')).toBe('node-1');
    expect(resolveStudioPropertiesNodeId('/ankh/properties/node%201')).toBe('node 1');
    expect(resolveStudioPropertiesNodeId('/ankh/apis')).toBeNull();
    expect(createStudioPropertiesRoutePath('node 1')).toBe('/ankh/properties/node%201');
    expect(createStudioAdminRoutePath({ routeId: 'properties', selectedNodeId: 'node 1' })).toBe(
      '/ankh/properties/node%201',
    );
    expect(createStudioAdminRoutePath({ routeId: 'properties', selectedNodeId: null })).toBeNull();
  });

  test('creates admin route render state', () => {
    expect(
      createStudioAdminRouteRenderState({
        pathname: '/ankh/auth/providers',
        activeAdminRouteId: 'overview',
      }),
    ).toEqual({
      routeAdminId: 'auth-providers',
      resolvedAdminRouteId: 'auth-providers',
      routeAdminPath: '/ankh/auth/providers',
      propertiesNodeId: null,
      shouldRenderAppContent: false,
      shouldRenderAdminShell: true,
    });
  });

  test('tracks hierarchy and contextual availability', () => {
    expect(
      isStudioAdminRouteActive({
        currentRouteId: 'auth-providers',
        candidateRouteId: 'auth',
      }),
    ).toBe(true);
    expect(
      isStudioAdminRouteActive({
        currentRouteId: 'auth-providers',
        candidateRouteId: 'apis',
      }),
    ).toBe(false);
    expect(isStudioAdminRouteAvailable('properties', { selectedNodeId: null })).toBe(false);
    expect(isStudioAdminRouteAvailable('properties', { selectedNodeId: 'node-1' })).toBe(true);
  });

  test('opens admin routes through canonical path helpers', () => {
    const panelIds: (string | null)[] = [];
    const routes: string[] = [];
    expect(
      openStudioAdminRoute({
        next: 'secrets',
        setActivePanelId: (panelId) => panelIds.push(panelId),
        pushRoute: (routePath) => routes.push(routePath),
      }),
    ).toBe(true);

    expect(
      openStudioAdminRoute({
        next: 'properties',
        selectedNodeId: null,
        setActivePanelId: (panelId) => panelIds.push(panelId),
        pushRoute: (routePath) => routes.push(routePath),
      }),
    ).toBe(false);

    expect(panelIds).toEqual([null]);
    expect(routes).toEqual(['/ankh/secrets']);
  });

  test('preserves search and hash when the runtime location matches the pathname', () => {
    const original = globalThis.location;
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { pathname: '/orders', search: '?filter=open', hash: '#row-1' },
    });

    try {
      expect(resolveStudioNavigableLocation('/orders')).toBe('/orders?filter=open#row-1');
      expect(resolveStudioNavigableLocation('/customers')).toBe('/customers');
      expect(resolveStudioLastNonAdminLocation({ pathname: '/orders' })).toBe(
        '/orders?filter=open#row-1',
      );
    } finally {
      Object.defineProperty(globalThis, 'location', {
        configurable: true,
        value: original,
      });
    }
  });

  test('tracks only useful non-admin locations and preserves native pathname fallback', () => {
    expect(
      resolveStudioLastNonAdminLocation({
        pathname: '/orders',
        navigableLocation: '/orders?filter=closed',
      }),
    ).toBe('/orders?filter=closed');
    expect(
      resolveStudioLastNonAdminLocation({
        pathname: '/ankh/apis',
        navigableLocation: '/ankh/apis?tab=operations',
      }),
    ).toBeNull();
    expect(resolveStudioLastNonAdminLocation({ pathname: '/native/orders' })).toBe(
      '/native/orders',
    );
  });
});
