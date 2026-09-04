/***
 * Convert a file-based route name into its public href, treating index as the root route.
 * @utility @ankhorage/utility/route
 */
export function routeNameToHref(routeName: string): string {
  const normalized = routeName.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  if (!normalized || normalized === 'index') {
    return '/';
  }

  return `/${normalized}`;
}

/***
 * Convert a file-based route name into its grouped Expo Router href, preserving the special app-root behavior.
 * @utility @ankhorage/utility/route
 */
export function routeNameToGroupedHref(routeName: string, groupName: string): string {
  const normalized = routeName.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  if (!normalized || normalized === 'index') {
    return groupName === 'app' ? '/' : `/(${groupName})`;
  }

  return `/${normalized}`;
}
