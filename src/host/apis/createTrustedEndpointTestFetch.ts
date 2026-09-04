import type { EndpointTestFetch } from '@ankhorage/data-sources';

import { requestTrustedExternalApi } from './requestTrustedExternalApi';

/***
 * Adapt Studio's trusted external HTTP transport to the endpoint-test fetch contract.
 * @todo Keep this thin data-source adapter at the external-apis host edge.
 */
export function createTrustedEndpointTestFetch(): EndpointTestFetch {
  return (url, init) => requestTrustedExternalApi(url, init);
}
