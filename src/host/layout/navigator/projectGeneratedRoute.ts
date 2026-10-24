import type { RouteDefinition } from '@ankhorage/contracts';
import path from 'path';

interface ProjectGeneratedRouteInput {
  readonly parentModulePath: string;
  readonly parentPublicPath: string;
  readonly route: RouteDefinition;
}

interface GeneratedRouteProjection {
  readonly modulePath: string;
  readonly publicPath: string;
}

/*** Project one manifest route into its Expo Router module and public path without making route groups URL segments. */
export function projectGeneratedRoute(input: ProjectGeneratedRouteInput): GeneratedRouteProjection {
  const publicPath = resolvePublicPath(input.parentPublicPath, input.route);
  const relativePublicPath = path.posix.relative(
    trimSlashes(input.parentPublicPath),
    trimSlashes(publicPath),
  );
  const groupPath = isRouteGroup(input.route.name) ? [input.route.name] : [];
  const publicPathSegments = relativePublicPath.length === 0 ? [] : [relativePublicPath];
  const modulePath = input.route.navigator
    ? path.posix.join(input.parentModulePath, ...groupPath, ...publicPathSegments)
    : path.posix.join(
        input.parentModulePath,
        ...groupPath,
        ...(publicPathSegments.length === 0 ? ['index'] : publicPathSegments),
      );
  return { modulePath, publicPath };
}

/*** Resolve a route's canonical public URL from its parent URL and authored route path. */
function resolvePublicPath(parentPublicPath: string, route: RouteDefinition): string {
  if (route.path?.startsWith('/')) return route.path || '/';
  const routeSegments = (route.path ?? route.name)
    .split('/')
    .filter((segment) => segment !== 'index' && !isRouteGroup(segment));
  const parentSegments = parentPublicPath.split('/').filter(Boolean);
  const segments = [...parentSegments, ...routeSegments];
  return segments.length === 0 ? '/' : `/${segments.join('/')}`;
}

/*** Strip leading and trailing slashes before calculating a relative Expo Router module path. */
function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/gu, '');
}

/*** Identify Expo Router group syntax, which owns module structure but no public URL segment. */
function isRouteGroup(segment: string): boolean {
  return /^\(.*\)$/u.test(segment);
}
