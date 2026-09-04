const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const BLOCKED_HOSTNAMES = new Set([
  '100.100.100.200',
  '169.254.169.254',
  '[fd00:ec2::254]',
  'metadata.google.internal',
]);

/***
 * Execute a credential-free, redirect-rejecting external HTTP request with timeout, target, and response-size safeguards.
 * @utility @ankhorage/utility/http
 */
export async function requestTrustedExternalApi(
  rawUrl: string,
  init: {
    readonly method: string;
    readonly headers: Readonly<Record<string, string>>;
    readonly body?: string;
  },
  options: { readonly timeoutMs?: number; readonly maxResponseBytes?: number } = {},
): Promise<{ readonly status: number; text(): Promise<string> }> {
  const url = parseTrustedUrl(rawUrl);
  const response = await fetch(url, {
    method: init.method,
    headers: init.headers,
    body: init.body,
    credentials: 'omit',
    redirect: 'error',
    signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });
  const maxBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  const textPromise = readLimitedResponseText(response, maxBytes);
  return { status: response.status, text: () => textPromise };
}

/***
 * Parse an HTTP(S) URL while rejecting inline credentials and caller-blocked sensitive hosts.
 * @utility @ankhorage/utility/url
 */
function parseTrustedUrl(rawUrl: string): URL {
  const url = new URL(rawUrl);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('External API transport supports HTTP and HTTPS only.');
  }
  if (url.username || url.password || BLOCKED_HOSTNAMES.has(url.hostname.toLowerCase())) {
    throw new Error('External API target is blocked by the trusted transport policy.');
  }
  return url;
}

/***
 * Read a response body as text while rejecting declared or measured payload sizes above a limit.
 * @utility @ankhorage/utility/http
 */
async function readLimitedResponseText(response: Response, maxBytes: number): Promise<string> {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error('External API response exceeds the configured size limit.');
  }

  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > maxBytes) {
    throw new Error('External API response exceeds the configured size limit.');
  }
  return new TextDecoder().decode(bytes);
}
