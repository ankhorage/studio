import type { RouteDefinition } from '@ankhorage/contracts';

export type { ScreenRouteEntry, ScreenRouteGroup } from './manifestState';
export {
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
} from './manifestState';

export function reorderLeafRoutesWithinParent(
  routes: RouteDefinition[],
  parentPath: string[],
  orderedRouteNames: string[],
): RouteDefinition[] {
  if (parentPath.length === 0) {
    return reorderMatchingRoutes(routes, orderedRouteNames);
  }

  const [segment, ...rest] = parentPath;

  return routes.map((route) => {
    if (route.name !== segment || !route.navigator?.routes) {
      return route;
    }

    return {
      ...route,
      navigator: {
        ...route.navigator,
        routes: reorderLeafRoutesWithinParent(route.navigator.routes, rest, orderedRouteNames),
      },
    };
  });
}

function reorderMatchingRoutes(
  routes: RouteDefinition[],
  orderedRouteNames: string[],
): RouteDefinition[] {
  const rank = new Map(orderedRouteNames.map((name, index) => [name, index]));
  const sortableRoutes = routes
    .filter((route) => rank.has(route.name))
    .sort((a, b) => (rank.get(a.name) ?? 0) - (rank.get(b.name) ?? 0));

  if (sortableRoutes.length <= 1) {
    return routes;
  }

  let cursor = 0;
  return routes.map((route) => {
    if (!rank.has(route.name)) return route;
    if (cursor >= sortableRoutes.length) {
      return route;
    }
    const next = sortableRoutes[cursor];
    if (!next) {
      return route;
    }
    cursor += 1;
    return next;
  });
}
