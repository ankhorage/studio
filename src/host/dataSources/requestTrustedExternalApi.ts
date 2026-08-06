const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const BLOCKED_HOSTNAMES = new Set([
  '100.100.100.200',
  '169.254.169.254',
  '[fd00:ec2::254]',
  'metadata.google.internal',
]);

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

async function readLimitedResponseText(response: Response, maxBytes: number): Promise<string> {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error('External API response exceeds the configured size limit.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parts: string[] = [];
  let bytes = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    bytes += chunk.value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel();
      throw new Error('External API response exceeds the configured size limit.');
    }
    parts.push(decoder.decode(chunk.value, { stream: true }));
  }
  parts.push(decoder.decode());
  return parts.join('');
}
