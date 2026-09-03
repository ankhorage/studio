/***
 * Resolve the logical parent route for Studio workspace/create/project paths.
 * @todo Move workspace route hierarchy policy out of the `app/` composition edge and into the owning `routes/` or `workspace/` domain.
 */
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

/***
 * Normalize an arbitrary pathname to one leading slash, no trailing slash, and `/` for blank/root input.
 * @utility @ankhorage/utility/url
 */
function normalizePathname(pathname: string): string {
  const trimmed = pathname.trim();
  if (!trimmed || trimmed === '/') return '/';
  return `/${trimmed.replace(/^\/+|\/+$/g, '')}`;
}
