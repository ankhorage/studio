import { slugifyAscii } from '@ankhorage/utility/string';

export type ExternalApiIdResult =
  { readonly ok: true; readonly apiId: string } | { readonly ok: false; readonly message: string };

/***
 * Normalize user input into the lowercase, hyphenated identifier format used for external APIs.
 */
export function normalizeExternalApiId(value: string): ExternalApiIdResult {
  const apiId = slugifyAscii(value).slice(0, 64);

  return apiId.length > 0
    ? { ok: true, apiId }
    : { ok: false, message: 'API ID must contain at least one letter or number.' };
}
