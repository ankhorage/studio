import { describe, expect, test } from 'bun:test';

import {
  createStudioAdminRoutePath,
  createStudioAdminRouteRenderState,
  createStudioBindingsRoutePath,
  createStudioModuleRoutePath,
  createStudioPropertiesRoutePath,
  createStudioScreenRoutePath,
  createStudioThemeRecipeRoutePath,
  isStudioAdminRouteActive,
  isStudioAdminRouteAvailable,
  openStudioAdminRoute,
  resolveStudioAdminRouteId,
  resolveStudioAdminRoutePath,
  resolveStudioBindingsNodeId,
  resolveStudioLastNonAdminLocation,
  resolveStudioModuleId,
  resolveStudioNavigableLocation,
  resolveStudioPropertiesNodeId,
  resolveStudioScreenId,
  resolveStudioThemeRecipeName,
  STUDIO_ADMIN_ROUTE_REGISTRY,
} from './studioAdminRouteModel';

describe('studioAdminRouteModel', () => {
  test('defines every canonical admin route once', () => {
    expect(STUDIO_ADMIN_ROUTE_REGISTRY.map((route) => route.id)).toEqual([
      'overview',
      'screens',
      'screen-detail',
      'apis',
      'api-data-sources',
      'api-operations',
      'modules',
      'module-detail',
      'auth',
      'auth-providers',
      'auth-routes',
      'auth-profile',
      'secrets',
      'theme',
      'theme-colors',
      'theme-typography',
      'theme-spacing',
      'theme-radii',
      'theme-shadows',
      'theme-component',
      'theme-pattern',
      'bindings',
      'properties',
    ]);
  });

  test('resolves admin route ids and concrete paths', () => {
    expect(resolveStudioAdminRouteId('/ankh')).toBe('overview');
    expect(resolveStudioAdminRouteId('/ankh/screens')).toBe('screens');
    expect(resolveStudioAdminRoutePath('/ankh/screens')).toBe('/ankh/screens');
    expect(createStudioAdminRoutePath({ routeId: 'screens' })).toBe('/ankh/screens');
    expect(resolveStudioAdminRouteId('/ankh/modules')).toBe('modules');
    expect(resolveStudioAdminRoutePath('/ankh/modules')).toBe('/ankh/modules');
    expect(resolveStudioAdminRouteId('/ankh/apis')).toBe('apis');
    expect(resolveStudioAdminRouteId('/ankh/apis/data-sources')).toBe('api-data-sources');
    expect(resolveStudioAdminRouteId('/ankh/apis/operations')).toBe('api-operations');
    expect(resolveStudioAdminRouteId('/ankh/auth')).toBe('auth');
    expect(resolveStudioAdminRouteId('/ankh/auth/providers')).toBe('auth-providers');
    expect(resolveStudioAdminRouteId('/ankh/auth/routes')).toBe('auth-routes');
    expect(resolveStudioAdminRouteId('/ankh/auth/profile')).toBe('auth-profile');
    expect(resolveStudioAdminRouteId('/ankh/secrets')).toBe('secrets');
    expect(resolveStudioAdminRouteId('/ankh/theme')).toBe('theme');
    expect(resolveStudioAdminRouteId('/ankh/theme/colors')).toBe('theme-colors');
    expect(resolveStudioAdminRouteId('/ankh/theme/typography')).toBe('theme-typography');
    expect(resolveStudioAdminRouteId('/ankh/theme/spacing')).toBe('theme-spacing');
    expect(resolveStudioAdminRouteId('/ankh/theme/radii')).toBe('theme-radii');
    expect(resolveStudioAdminRouteId('/ankh/theme/shadows')).toBe('theme-shadows');
    const componentRecipe = createStudioThemeRecipeRoutePath('component', 'Button / primary');
    const patternRecipe = createStudioThemeRecipeRoutePath('pattern', 'Panel');
    expect(componentRecipe).toBe('/ankh/theme/components/Button%20%2F%20primary');
    expect(patternRecipe).toBe('/ankh/theme/patterns/Panel');
    expect(resolveStudioThemeRecipeName(componentRecipe)).toBe('Button / primary');
    expect(resolveStudioThemeRecipeName(patternRecipe)).toBe('Panel');
    expect(resolveStudioAdminRouteId(componentRecipe)).toBe('theme-component');
    expect(resolveStudioAdminRouteId(patternRecipe)).toBe('theme-pattern');
    expect(resolveStudioAdminRoutePath(componentRecipe)).toBe(componentRecipe);
    expect(resolveStudioAdminRoutePath(patternRecipe)).toBe(patternRecipe);
    expect(
      createStudioAdminRoutePath({
        routeId: 'theme-component',
        themeRecipeName: 'Button / primary',
      }),
    ).toBe(componentRecipe);
    expect(
      isStudioAdminRouteActive({ currentRouteId: 'theme-spacing', candidateRouteId: 'theme' }),
    ).toBe(true);
    expect(resolveStudioAdminRouteId('/ankh/bindings/node-1')).toBe('bindings');
    expect(resolveStudioAdminRouteId('/ankh/properties/node-1')).toBe('properties');
    expect(resolveStudioAdminRoutePath('/ankh/bindings/node-1')).toBe('/ankh/bindings/node-1');
    expect(resolveStudioAdminRoutePath('/ankh/properties/node-1')).toBe('/ankh/properties/node-1');
    expect(resolveStudioAdminRouteId('/app')).toBeNull();
  });

  test('round-trips encoded stable module ids without treating the overview as detail', () => {
    const moduleId = 'vendor/module / café';
    const routePath = createStudioModuleRoutePath(moduleId);

    expect(routePath).toBe('/ankh/modules/vendor%2Fmodule%20%2F%20caf%C3%A9');
    expect(resolveStudioModuleId(routePath)).toBe(moduleId);
    expect(resolveStudioAdminRouteId(routePath)).toBe('module-detail');
    expect(resolveStudioAdminRoutePath(routePath)).toBe(routePath);
    expect(createStudioAdminRoutePath({ routeId: 'module-detail', moduleId })).toBe(routePath);
    expect(resolveStudioModuleId('/ankh/modules')).toBeNull();
    expect(resolveStudioModuleId('/ankh/modules/')).toBeNull();
    expect(resolveStudioModuleId('/ankh/modules/module/extra')).toBeNull();
    expect(resolveStudioModuleId('/ankh/modules/%E0%A4%A')).toBeNull();
    expect(createStudioAdminRoutePath({ routeId: 'module-detail' })).toBeNull();
  });

  test('round-trips encoded stable screen ids without treating the overview as detail', () => {
    const screenId = 'screen / café';
    const routePath = createStudioScreenRoutePath(screenId);

    expect(routePath).toBe('/ankh/screens/screen%20%2F%20caf%C3%A9');
    expect(resolveStudioScreenId(routePath)).toBe(screenId);
    expect(resolveStudioAdminRouteId(routePath)).toBe('screen-detail');
    expect(resolveStudioAdminRoutePath(routePath)).toBe(routePath);
    expect(createStudioAdminRoutePath({ routeId: 'screen-detail', screenId })).toBe(routePath);
    expect(resolveStudioScreenId('/ankh/screens')).toBeNull();
    expect(resolveStudioScreenId('/ankh/screens/')).toBeNull();
    expect(resolveStudioScreenId('/ankh/screens/screen-1/extra')).toBeNull();
    expect(resolveStudioScreenId('/ankh/screens/%E0%A4%A')).toBeNull();
    expect(createStudioAdminRoutePath({ routeId: 'screen-detail' })).toBeNull();
  });

  test('resolves contextual node ids and creates contextual paths', () => {
    expect(resolveStudioBindingsNodeId('/ankh/bindings/node-1')).toBe('node-1');
    expect(resolveStudioBindingsNodeId('/ankh/bindings/node%201')).toBe('node 1');
    expect(resolveStudioBindingsNodeId('/ankh/apis')).toBeNull();
    expect(createStudioBindingsRoutePath('node 1')).toBe('/ankh/bindings/node%201');
    expect(createStudioAdminRoutePath({ routeId: 'bindings', selectedNodeId: 'node 1' })).toBe(
      '/ankh/bindings/node%201',
    );
    expect(createStudioAdminRoutePath({ routeId: 'bindings', selectedNodeId: null })).toBeNull();

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
      screenId: null,
      moduleId: null,
      bindingsNodeId: null,
      propertiesNodeId: null,
      shouldRenderAppContent: false,
      shouldRenderAdminShell: true,
    });
    expect(
      createStudioAdminRouteRenderState({
        pathname: '/ankh/bindings/button-1',
        activeAdminRouteId: 'overview',
      }).bindingsNodeId,
    ).toBe('button-1');
    expect(
      createStudioAdminRouteRenderState({
        pathname: '/ankh/screens/screen%20one',
        activeAdminRouteId: 'overview',
      }),
    ).toMatchObject({
      routeAdminId: 'screen-detail',
      resolvedAdminRouteId: 'screen-detail',
      screenId: 'screen one',
      shouldRenderAppContent: false,
      shouldRenderAdminShell: true,
    });
    expect(
      createStudioAdminRouteRenderState({
        pathname: '/ankh/modules/vendor%2Fmodule',
        activeAdminRouteId: 'overview',
      }),
    ).toMatchObject({
      routeAdminId: 'module-detail',
      resolvedAdminRouteId: 'module-detail',
      moduleId: 'vendor/module',
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
    expect(isStudioAdminRouteAvailable('module-detail', { selectedNodeId: null })).toBe(false);
    expect(
      isStudioAdminRouteAvailable('module-detail', {
        selectedNodeId: null,
        moduleId: 'vendor/module',
      }),
    ).toBe(true);
    expect(
      isStudioAdminRouteActive({
        currentRouteId: 'module-detail',
        candidateRouteId: 'modules',
      }),
    ).toBe(true);
    expect(
      isStudioAdminRouteActive({
        currentRouteId: 'auth-providers',
        candidateRouteId: 'apis',
      }),
    ).toBe(false);
    expect(isStudioAdminRouteAvailable('bindings', { selectedNodeId: null })).toBe(false);
    expect(isStudioAdminRouteAvailable('bindings', { selectedNodeId: 'node-1' })).toBe(true);
    expect(isStudioAdminRouteAvailable('properties', { selectedNodeId: null })).toBe(false);
    expect(isStudioAdminRouteAvailable('properties', { selectedNodeId: 'node-1' })).toBe(true);
    expect(isStudioAdminRouteAvailable('screen-detail', { selectedNodeId: null })).toBe(false);
    expect(
      isStudioAdminRouteAvailable('screen-detail', {
        selectedNodeId: null,
        screenId: 'screen-1',
      }),
    ).toBe(true);
    expect(
      isStudioAdminRouteActive({
        currentRouteId: 'screen-detail',
        candidateRouteId: 'screens',
      }),
    ).toBe(true);
  });

  test('opens admin routes through canonical path helpers', () => {
    const panelIds: (string | null)[] = [];
    const routes: string[] = [];
    expect(
      openStudioAdminRoute({
        next: 'screens',
        setActivePanelId: (panelId) => panelIds.push(panelId),
        pushRoute: (routePath) => routes.push(routePath),
      }),
    ).toBe(true);

    expect(
      openStudioAdminRoute({
        next: 'bindings',
        selectedNodeId: null,
        setActivePanelId: (panelId) => panelIds.push(panelId),
        pushRoute: (routePath) => routes.push(routePath),
      }),
    ).toBe(false);

    expect(
      openStudioAdminRoute({
        next: 'screen-detail',
        screenId: 'screen 1',
        setActivePanelId: (panelId) => panelIds.push(panelId),
        pushRoute: (routePath) => routes.push(routePath),
      }),
    ).toBe(true);

    expect(panelIds).toEqual([null, null]);
    expect(routes).toEqual(['/ankh/screens', '/ankh/screens/screen%201']);
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
