import type { ExternalApiFetch } from '@ankhorage/data-sources';

import { requestTrustedExternalApi } from './requestTrustedExternalApi';

export function createTrustedExternalApiFetch(): ExternalApiFetch {
  return (url, init) => requestTrustedExternalApi(url, init);
}
