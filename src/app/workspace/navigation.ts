interface FocusableWorkspaceElement {
  blur: () => void;
}

/*** Move focus out of an outgoing web route before Expo Router hides it from assistive technology. */
export function releaseWorkspaceFocus(
  activeElement: FocusableWorkspaceElement | null = getFocusedWorkspaceElement(),
): void {
  activeElement?.blur();
}

/*** Resolve the active Workspace route's canonical parent fallback. */
export function resolveWorkspaceParentPath(pathname: string): string | null {
  const normalized = normalizePathname(pathname);

  if (normalized === '/') return null;
  if (normalized === '/create') return '/';
  if (normalized.startsWith('/projects/')) return '/';

  const createMatch = /^\/create\/([^/]+)(?:\/([^/]+))?$/u.exec(normalized);
  if (!createMatch) return '/';

  const [, category, templateId] = createMatch;
  if (category && templateId) return `/create/${category}`;
  return '/create';
}

function normalizePathname(pathname: string): string {
  const trimmed = pathname.trim();
  if (!trimmed || trimmed === '/') return '/';
  return `/${trimmed.replace(/^\/+|\/+$/g, '')}`;
}

/*** Read the currently focused HTML element when Studio runs on the web. */
function getFocusedWorkspaceElement(): FocusableWorkspaceElement | null {
  if (typeof document === 'undefined') return null;

  const { activeElement } = document;
  return activeElement instanceof HTMLElement ? activeElement : null;
}
