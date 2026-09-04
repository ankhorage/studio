import type { EndpointTestResult } from '@ankhorage/data-sources';
import { redactUrlQueryValues } from '@ankhorage/utility/url';

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
        url: redactUrlQueryValues(result.request.url),
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
