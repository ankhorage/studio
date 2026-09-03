import { useCallback } from 'react';

import { API_BASE } from '../core/constants';

export interface InstallWorkspacePackagesResponse {
  success: boolean;
  scope: 'workspace';
}

/***
 * Return whether an unknown value is any non-null JavaScript object, including arrays.
 * @utility @ankhorage/utility/object
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/***
 * Decode a Response body as JSON without applying domain validation.
 * @utility @ankhorage/utility/http
 */
async function readJson(response: Response): Promise<unknown> {
  return await response.json();
}

/*** Validate the host acknowledgement after installing workspace packages. */
function parseInstallWorkspacePackagesResponse(value: unknown): InstallWorkspacePackagesResponse {
  if (!isRecord(value) || value.success !== true || value.scope !== 'workspace') {
    throw new Error('Install packages response was invalid');
  }

  return {
    success: true,
    scope: 'workspace',
  };
}

/***
 * Expose workspace package-install actions to React consumers.
 * @todo Move workspace HTTP/application behavior out of the generic hooks folder and into the workspace owner.
 */
export function useWorkspaceActions() {
  /*** Install workspace packages through the Studio host and validate its acknowledgement. */
  const installWorkspacePackages =
    useCallback(async (): Promise<InstallWorkspacePackagesResponse> => {
      const response = await fetch(`${API_BASE}/workspace/packages/install`, { method: 'POST' });
      if (!response.ok) {
        throw new Error('Failed to install workspace packages');
      }

      return parseInstallWorkspacePackagesResponse(await readJson(response));
    }, []);

  return { installWorkspacePackages };
}
