export type ExternalApiIdResult =
  { readonly ok: true; readonly apiId: string } | { readonly ok: false; readonly message: string };

export function normalizeExternalApiId(value: string): ExternalApiIdResult {
  const apiId = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 64);

  return apiId.length > 0
    ? { ok: true, apiId }
    : { ok: false, message: 'API ID must contain at least one letter or number.' };
}
