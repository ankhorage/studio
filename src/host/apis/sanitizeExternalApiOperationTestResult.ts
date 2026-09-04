import type { EndpointTestResult } from '@ankhorage/data-sources';

import type { ExternalApiOperationTestResult } from '../../externalApiAuthoringContracts';

/***
 * Project an endpoint-test result into the Studio authoring response while removing sensitive request details.
 * @todo Keep this external-API response projection with the external-apis application/host boundary.
 */
export function sanitizeExternalApiOperationTestResult(
  result: EndpointTestResult,
): ExternalApiOperationTestResult {
  const request = result.request
    ? {
        method: result.request.method,
        url: redactQueryValues(result.request.url),
        dryRun: result.request.dryRun,
      }
    : undefined;
  const response = result.response
    ? { status: result.response.status, ok: result.response.ok }
    : undefined;

  return result.ok
    ? {
        ok: true,
        request: request ?? { method: 'UNKNOWN', url: '', dryRun: false },
        response,
        data: result.data,
        diagnostics: result.diagnostics,
      }
    : { ok: false, request, response, diagnostics: result.diagnostics };
}

/***
 * Redact every query-parameter value from a URL while preserving the URL shape and tolerating invalid input.
 * @utility @ankhorage/utility/url
 */
function redactQueryValues(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    for (const key of [...url.searchParams.keys()]) {
      url.searchParams.set(key, '[redacted]');
    }
    return url.toString();
  } catch {
    return rawUrl.split('?')[0] ?? rawUrl;
  }
}
