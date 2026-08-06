import type { EndpointTestResult } from '@ankhorage/data-sources';

import type { ExternalApiOperationTestResult } from '../../externalApiAuthoringContracts';

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
