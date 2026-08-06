import type { EndpointTestFetch } from '@ankhorage/data-sources';

import { requestTrustedExternalApi } from './requestTrustedExternalApi';

export function createTrustedEndpointTestFetch(): EndpointTestFetch {
  return (url, init) => requestTrustedExternalApi(url, init);
}
