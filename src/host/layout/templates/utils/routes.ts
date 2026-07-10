export function routeNameToHref(routeName: string): string {
  const normalized = routeName.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  if (!normalized || normalized === 'index') {
    return '/';
  }

  return `/${normalized}`;
}

export function routeNameToGroupedHref(routeName: string, groupName: string): string {
  const normalized = routeName.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  if (!normalized || normalized === 'index') {
    return groupName === 'app' ? '/' : `/(${groupName})`;
  }

  return `/${normalized}`;
}
