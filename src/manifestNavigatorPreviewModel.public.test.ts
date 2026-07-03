import type { NavigatorSpec, RouteDefinition } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import type {
  ManifestNavigatorPreviewModel,
  PreviewNavigationDiagnostic,
  PreviewNavigationRoute,
  StudioNavigationRouteMap,
  StudioNavigationRouteMapEntry,
} from './manifestNavigatorPreviewModel';
import {
  buildManifestNavigatorPreviewModel,
  resolveLeafScreenIdForChromeRouteName,
  resolveLeafScreenIdForRoute,
} from './manifestNavigatorPreviewModel';

describe('manifest navigator preview model public exports', () => {
  test('types and helpers are usable from the public module', () => {
    const route: RouteDefinition = { name: 'index', screenId: 'screen-index' };
    const navigator: NavigatorSpec = { type: 'tabs', routes: [route] };
    const visibleRoute: PreviewNavigationRoute = { name: 'index', label: 'Index', route };
    const mapEntry: StudioNavigationRouteMapEntry = { label: 'Index' };
    const routeMap: StudioNavigationRouteMap = { index: mapEntry };
    const diagnostic: PreviewNavigationDiagnostic = {
      kind: 'icon',
      severity: 'warning',
      message: 'message',
      routeName: 'index',
    };
    const model: Pick<ManifestNavigatorPreviewModel, 'navigator' | 'routeMap' | 'iconDiagnostics'> = {
      navigator,
      routeMap,
      iconDiagnostics: [diagnostic],
    };

    expect(model.routeMap.index?.label).toBe('Index');
    expect(resolveLeafScreenIdForRoute(route)).toBe('screen-index');
    expect(
      resolveLeafScreenIdForChromeRouteName({
        navigator,
        visibleRoutes: [visibleRoute],
        routeName: 'index',
      }),
    ).toBe('screen-index');
    expect(typeof buildManifestNavigatorPreviewModel).toBe('function');
  });
});
