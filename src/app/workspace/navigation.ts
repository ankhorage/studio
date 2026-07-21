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
