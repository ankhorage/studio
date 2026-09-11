import type { ExternalApiIdResult } from './normalizeExternalApiId';
import { normalizeExternalApiId } from './normalizeExternalApiId';

/*** Derive the canonical external API id from an HTTP(S) URL while ignoring scheme, query, and fragment. */
export function deriveExternalApiIdFromUrl(value: string): ExternalApiIdResult {
  const parsed = parseExternalApiUrl(value);
  if (!parsed) {
    return {
      ok: false,
      message: 'Enter a valid HTTP or HTTPS API URL.',
    };
  }

  const path = decodePathname(parsed.pathname)
    .split('/')
    .filter(Boolean)
    .join('-');
  return normalizeExternalApiId(path ? `${parsed.host}-${path}` : parsed.host);
}

/*** Parse a user-entered external API URL and accept only HTTP(S) service locations. */
function parseExternalApiUrl(value: string): URL | null {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed : null;
  } catch {
    return null;
  }
}

/*** Decode a URL pathname for human-stable identifier normalization while tolerating malformed escapes. */
function decodePathname(pathname: string): string {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}
