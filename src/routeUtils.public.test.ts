import { expect, test } from 'bun:test';

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
  resolveScreenIdForPathname,
  toCanonicalRoutePattern,
  updateNavigatorAtPath,
} from './routeUtils';

const PUBLIC_ROUTE_UTILITY_VALUES = [
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
  resolveScreenIdForPathname,
  toCanonicalRoutePattern,
  updateNavigatorAtPath,
] as const;

type PublicRouteUtilityTypes = readonly [ScreenRouteEntry, ScreenRouteGroup];

test('keeps the route-utils public surface reachable without replaying owner behavior', () => {
  for (const exportedValue of PUBLIC_ROUTE_UTILITY_VALUES) {
    expect(exportedValue).toBeDefined();
  }

  const exportedTypes: PublicRouteUtilityTypes | null = null;
  expect(exportedTypes).toBeNull();
});
