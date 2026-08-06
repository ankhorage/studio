export type ExternalApiSourceIdResult =
  | { readonly ok: true; readonly sourceId: string }
  | { readonly ok: false; readonly message: string };

export function normalizeExternalApiSourceId(value: string): ExternalApiSourceIdResult {
  const sourceId = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 64);

  return sourceId.length > 0
    ? { ok: true, sourceId }
    : { ok: false, message: 'Data-source ID must contain at least one letter or number.' };
}
