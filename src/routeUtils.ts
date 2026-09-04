import type { AppManifest, NavigatorSpec } from '@ankhorage/contracts';
import { readOwnProperty } from '@ankhorage/utility/object';
import {
  normalizePathnameSegments,
  normalizeRoutePatternSegments,
  scoreRoutePatternMatch,
} from '@ankhorage/utility/route';

import {
  collectScreenRouteEntries,
  hasCanonicalStudioScreenRegistryIdentity,
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

/***
 * Resolve the leaf screen owned by a pathname using Studio manifest navigation and route specificity.
 * @todo Move Studio/contracts screen resolution under src/routes/ or the shared runtime owner; keep generic route matching in Utility.
 */
export function resolveScreenIdForPathname(
  navigator: NavigatorSpec,
  pathname: string,
  screens?: AppManifest['screens'],
): string | null {
  if (screens && !hasCanonicalStudioScreenRegistryIdentity(screens)) return null;
  const pathnameSegments = normalizePathnameSegments(pathname);
  let bestMatch: ScreenRouteMatch | null = null;

  for (const entry of collectScreenRouteEntries(navigator.routes)) {
    const screen = screens
      ? readOwnProperty<AppManifest['screens'][string]>(screens, entry.screenId)
      : undefined;
    if (screens && !screen) continue;
    const patternSegments = normalizeRoutePatternSegments(entry.routePath);
    const score = scoreRoutePatternMatch(patternSegments, pathnameSegments);
    if (score === null || (bestMatch && score <= bestMatch.score)) continue;
    bestMatch = { screenId: screen?.id ?? entry.screenId, score };
  }

  if (bestMatch) return bestMatch.screenId;
  return pathnameSegments.length === 0 ? resolveInitialScreenId(navigator, screens) : null;
}
