import { useCallback } from 'react';

import { API_BASE } from '../core/constants';

export interface InstallWorkspacePackagesResponse {
  success: boolean;
  scope: 'workspace';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function readJson(response: Response): Promise<unknown> {
  return await response.json();
}

function parseInstallWorkspacePackagesResponse(value: unknown): InstallWorkspacePackagesResponse {
  if (!isRecord(value) || value.success !== true || value.scope !== 'workspace') {
    throw new Error('Install packages response was invalid');
  }

  return {
    success: true,
    scope: 'workspace',
  };
}

export function useWorkspaceActions() {
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
