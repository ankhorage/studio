import type { NavigatorNode, RouteDefinition } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import { createStudioAdminNavigator } from './createStudioAdminNavigator';

function getRoute(navigator: NavigatorNode, name: string): RouteDefinition {
  const route = navigator.routes.find((candidate) => candidate.name === name);
  if (!route) throw new Error(`Missing Navigator route '${name}'.`);
  return route;
}

function getNestedNavigator(route: RouteDefinition): NavigatorNode {
  if (!route.navigator) throw new Error(`Route '${route.name}' has no nested Navigator.`);
  return route.navigator;
}

describe('createStudioAdminNavigator', () => {
  test('projects top-level Studio administration into a Navigator-owned Drawer', () => {
    const navigator = createStudioAdminNavigator();

    expect(navigator.type).toBe('drawer');
    if (navigator.type !== 'drawer') throw new Error('Expected a Drawer Navigator.');

    expect(navigator.options).toEqual({
      drawerPosition: 'left',
      drawerType: 'front',
      swipeEnabled: true,
      headerShown: true,
    });
    expect(navigator.routes.map((route) => route.name)).toEqual([
      'index',
      'screens',
      'media',
      'apis',
      'modules',
      'auth',
      'secrets',
      'deploy',
      'theme',
      'bindings',
      'properties',
    ]);
  });

  test('projects parent/detail administration routes into nested Navigator Stacks', () => {
    const navigator = createStudioAdminNavigator();
    const screens = getNestedNavigator(getRoute(navigator, 'screens'));
    const apis = getNestedNavigator(getRoute(navigator, 'apis'));
    const theme = getNestedNavigator(getRoute(navigator, 'theme'));

    expect(screens.type).toBe('stack');
    expect(screens.routes.map((route) => route.name)).toEqual(['index', '[screenId]']);
    expect(apis.routes.map((route) => route.name)).toEqual(['index', 'catalog', 'operations']);
    expect(theme.routes.map((route) => route.name)).toEqual([
      'index',
      'colors',
      'typography',
      'spacing',
      'radii',
      'shadows',
      'components',
      'patterns',
    ]);
    expect(
      getNestedNavigator(getRoute(theme, 'components')).routes.map((route) => route.name),
    ).toEqual(['[recipeName]']);
    expect(getNestedNavigator(getRoute(theme, 'patterns')).routes.map((route) => route.name)).toEqual([
      '[recipeName]',
    ]);
  });

  test('keeps parameterized authoring-context routes routable without exposing invalid static Drawer links', () => {
    const navigator = createStudioAdminNavigator();
    const bindings = getRoute(navigator, 'bindings');
    const properties = getRoute(navigator, 'properties');

    expect(bindings.showInPrimaryNavigation).toBe(false);
    expect(properties.showInPrimaryNavigation).toBe(false);
    expect(getNestedNavigator(bindings).routes.map((route) => route.name)).toEqual(['[nodeId]']);
    expect(getNestedNavigator(properties).routes.map((route) => route.name)).toEqual(['[nodeId]']);
  });
});
