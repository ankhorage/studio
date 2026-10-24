import type { RouteDefinition } from '@ankhorage/contracts';
import path from 'path';

/*** Resolve the canonical public path for one route without making Expo route groups URL segments. */
export function resolveGeneratedPublicRoutePath(
  parentPublicPath: string,
  route: RouteDefinition,
): string {
  if (route.path?.startsWith('/')) return route.path || '/';
  const routeSegments = (route.path ?? route.name)
    .split('/')
    .filter((segment) => segment !== 'index' && !isRouteGroup(segment));
  const parentSegments = parentPublicPath.split('/').filter(Boolean);
  const segments = [...parentSegments, ...routeSegments];
  return segments.length === 0 ? '/' : `/${segments.join('/')}`;
}

/*** Project one manifest route into its Expo Router module path while preserving route-group ownership. */
export function resolveGeneratedRoutePath(
  currentPath: string,
  parentPublicPath: string,
  route: RouteDefinition,
): string {
  const publicPath = resolveGeneratedPublicRoutePath(parentPublicPath, route);
  const relativePublicPath = path.posix.relative(
    parentPublicPath.replace(/^\/+|\/+$/g, ''),
    publicPath.replace(/^\/+|\/+$/g, ''),
  );
  const groupPath = isRouteGroup(route.name) ? [route.name] : [];
  const publicPathSegments = relativePublicPath.length === 0 ? [] : [relativePublicPath];
  if (route.navigator) return path.posix.join(currentPath, ...groupPath, ...publicPathSegments);
  return path.posix.join(
    currentPath,
    ...groupPath,
    ...(publicPathSegments.length === 0 ? ['index'] : publicPathSegments),
  );
}

/*** Identify the Expo Router group syntax that owns layout structure but no public URL segment. */
function isRouteGroup(segment: string): boolean {
  return /^\(.*\)$/u.test(segment);
}
