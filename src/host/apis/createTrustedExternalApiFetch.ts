import type { ExternalApiFetch } from '@ankhorage/data-sources';

import { requestTrustedExternalApi } from './requestTrustedExternalApi';

/***
 * Adapt Studio's trusted external HTTP transport to the external-API discovery fetch contract.
 * @todo Keep this thin data-source adapter at the external-apis host edge.
 */
export function createTrustedExternalApiFetch(): ExternalApiFetch {
  return (url, init) => requestTrustedExternalApi(url, init);
}
