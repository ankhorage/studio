import {
  requestTrustedHttp,
  type TrustedHttpRequestInit,
  type TrustedHttpRequestOptions,
} from '@ankhorage/utility/http';

/*** Execute an external API request through the shared trusted HTTP transport. */
export async function requestTrustedExternalApi(
  rawUrl: string,
  init: TrustedHttpRequestInit,
  options: Pick<TrustedHttpRequestOptions, 'timeoutMs' | 'maxResponseBytes'> = {},
): Promise<{ readonly status: number; text(): Promise<string> }> {
  return requestTrustedHttp(rawUrl, init, options);
}
