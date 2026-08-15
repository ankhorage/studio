import type { ProjectDeployRequest } from './projectDeployRequest';

export function createProjectDeployRequest(): ProjectDeployRequest {
  return async (path, init) => {
    const { API_BASE } = await import('./core/constants');
    return fetch(`${API_BASE}${path}`, init);
  };
}
