import type { AppManifest, NavigatorSpec } from '@ankhorage/contracts';

import {
  collectScreenRouteEntries,
  isRouteGroupSegment,
  resolveInitialScreenId,
} from './manifestState';

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

interface ScreenRouteMatch {
  readonly screenId: string;
  readonly score: number;
}

const DYNAMIC_ROUTE_SEGMENT_PATTERN = /^\[[^.[\]]+\]$|^:[^/]+$/u;
const CATCH_ALL_ROUTE_SEGMENT_PATTERN = /^\[\.\.\.[^\]]+\]$/u;
const OPTIONAL_CATCH_ALL_ROUTE_SEGMENT_PATTERN = /^\[\[\.\.\.[^\]]+\]\]$/u;

/**
 * Resolves the leaf screen owned by a pathname through an arbitrarily nested
 * manifest navigator tree. Static route segments take precedence over dynamic
 * and catch-all segments, matching Expo Router's route specificity.
 */
export function resolveScreenIdForPathname(
  navigator: NavigatorSpec,
  pathname: string,
  screens?: AppManifest['screens'],
): string | null {
  const pathnameSegments = normalizePathnameSegments(pathname);
  let bestMatch: ScreenRouteMatch | null = null;

  for (const entry of collectScreenRouteEntries(navigator.routes)) {
    if (screens && !screens[entry.screenId]) continue;
    const patternSegments = normalizeRoutePatternSegments(entry.routePath);
    const score = scoreRoutePatternMatch(patternSegments, pathnameSegments);
    if (score === null || (bestMatch && score <= bestMatch.score)) continue;
    bestMatch = { screenId: entry.screenId, score };
  }

  if (bestMatch) return bestMatch.screenId;
  return pathnameSegments.length === 0 ? resolveInitialScreenId(navigator, screens) : null;
}

function normalizePathnameSegments(pathname: string): string[] {
  const [pathWithoutQuery = ''] = pathname.trim().split(/[?#]/u, 1);
  return pathWithoutQuery.split('/').filter(Boolean);
}

function normalizeRoutePatternSegments(routePath: readonly string[]): string[] {
  const segments = routePath
    .flatMap((segment) => segment.split('/'))
    .filter(Boolean)
    .filter((segment) => !isRouteGroupSegment(segment));

  while (segments[0] === 'index') segments.shift();
  while (segments.at(-1) === 'index') segments.pop();
  return segments;
}

function scoreRoutePatternMatch(
  pattern: readonly string[],
  pathname: readonly string[],
): number | null {
  let patternIndex = 0;
  let pathnameIndex = 0;
  let score = 0;
  let exactMatch = true;

  while (patternIndex < pattern.length) {
    const routeSegment = pattern[patternIndex];
    if (!routeSegment) return null;

    if (OPTIONAL_CATCH_ALL_ROUTE_SEGMENT_PATTERN.test(routeSegment)) {
      exactMatch = false;
      if (pathnameIndex < pathname.length) score += 1;
      pathnameIndex = pathname.length;
      patternIndex += 1;
      continue;
    }

    if (CATCH_ALL_ROUTE_SEGMENT_PATTERN.test(routeSegment)) {
      if (pathnameIndex >= pathname.length) return null;
      exactMatch = false;
      pathnameIndex = pathname.length;
      patternIndex += 1;
      score += 1;
      continue;
    }

    const pathnameSegment = pathname[pathnameIndex];
    if (!pathnameSegment) return null;

    if (DYNAMIC_ROUTE_SEGMENT_PATTERN.test(routeSegment)) {
      score += 10;
    } else if (routeSegment === pathnameSegment) {
      score += 100;
    } else {
      return null;
    }

    patternIndex += 1;
    pathnameIndex += 1;
  }

  return pathnameIndex === pathname.length ? score + (exactMatch ? 5 : 0) : null;
}
