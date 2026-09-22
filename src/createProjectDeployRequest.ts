import { createBaseUrlFetch } from '@ankhorage/utility/http';

import type { ProjectDeployRequest } from './projectDeployRequest';

/***
 * Create a fetch-compatible request function that prefixes relative paths with the Studio API base.
 * @utility @ankhorage/utility/http
 */
export function createProjectDeployRequest(): ProjectDeployRequest {
  /*** Prefix a request path with the resolved API base and forward the fetch init unchanged. */
  return async (path, init) => {
    const { studioApiBase } = await import('./utils/studioApiBase');
    return createBaseUrlFetch(studioApiBase)(path, init);
  };
}
