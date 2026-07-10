import { useCallback, useEffect, useState } from 'react';

import { API_BASE } from '../core/constants';

export interface Project {
  id: string;
  name: string;
  path: string;
  version: string;
  isAnkhApp: boolean;
}

export interface CreateProjectResponse {
  success: boolean;
  id: string;
  path: string;
}

export interface SyncProjectResponse {
  success: boolean;
}

export interface InstallWorkspacePackagesResponse {
  success: boolean;
  scope: 'workspace';
  projectId?: string;
  deprecated?: boolean;
}

export interface UpProjectInfrastructureResponse {
  success: boolean;
  skipped?: string;
  target?: string;
  regenerated?: unknown;
}

export interface LaunchProjectResponse {
  success: boolean;
  skipped?: string;
  target?: string;
  url?: string;
  started?: boolean;
}

export interface CreateProjectInput {
  category: string;
  templateId: string;
  name: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isProject(value: unknown): value is Project {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.path === 'string' &&
    typeof value.version === 'string' &&
    typeof value.isAnkhApp === 'boolean'
  );
}

async function readJson(response: Response): Promise<unknown> {
  return await response.json();
}

function parseProjectList(value: unknown): Project[] {
  if (!Array.isArray(value) || !value.every(isProject)) {
    throw new Error('Projects response was not a valid project list');
  }

  return value;
}

function parseCreateProjectResponse(value: unknown): CreateProjectResponse {
  if (
    !isRecord(value) ||
    typeof value.success !== 'boolean' ||
    typeof value.id !== 'string' ||
    typeof value.path !== 'string'
  ) {
    throw new Error('Create project response was invalid');
  }

  return {
    success: value.success,
    id: value.id,
    path: value.path,
  };
}

function parseSyncProjectResponse(value: unknown): SyncProjectResponse {
  if (!isRecord(value) || typeof value.success !== 'boolean') {
    throw new Error('Sync response was invalid');
  }

  return { success: value.success };
}

function parseInstallWorkspacePackagesResponse(value: unknown): InstallWorkspacePackagesResponse {
  if (!isRecord(value) || typeof value.success !== 'boolean' || value.scope !== 'workspace') {
    throw new Error('Install packages response was invalid');
  }

  return {
    success: value.success,
    scope: 'workspace',
    projectId: typeof value.projectId === 'string' ? value.projectId : undefined,
    deprecated: typeof value.deprecated === 'boolean' ? value.deprecated : undefined,
  };
}

function parseUpProjectInfrastructureResponse(value: unknown): UpProjectInfrastructureResponse {
  if (!isRecord(value) || typeof value.success !== 'boolean') {
    throw new Error('Infrastructure response was invalid');
  }

  return {
    success: value.success,
    skipped: typeof value.skipped === 'string' ? value.skipped : undefined,
    target: typeof value.target === 'string' ? value.target : undefined,
    regenerated: value.regenerated,
  };
}

function parseLaunchProjectResponse(value: unknown): LaunchProjectResponse {
  if (!isRecord(value) || typeof value.success !== 'boolean') {
    throw new Error('Launch response was invalid');
  }

  return {
    success: value.success,
    skipped: typeof value.skipped === 'string' ? value.skipped : undefined,
    target: typeof value.target === 'string' ? value.target : undefined,
    url: typeof value.url === 'string' ? value.url : undefined,
    started: typeof value.started === 'boolean' ? value.started : undefined,
  };
}

export const useProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE}/projects`);
      if (!res.ok) throw new Error('Failed to fetch projects');
      const data = parseProjectList(await readJson(res));
      setProjects(data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Could not connect to the local Studio host. Run `ankh studio dev`.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createProject = async (input: CreateProjectInput): Promise<CreateProjectResponse> => {
    const res = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error('Failed to create project');
    await fetchProjects();
    return parseCreateProjectResponse(await readJson(res));
  };

  const deleteProject = async (projectId: string) => {
    const res = await fetch(`${API_BASE}/projects/${projectId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete project');
    await fetchProjects();
  };

  const syncProject = async (projectId: string): Promise<SyncProjectResponse> => {
    const res = await fetch(`${API_BASE}/projects/${projectId}/sync`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to sync project');
    return parseSyncProjectResponse(await readJson(res));
  };

  const installWorkspacePackages = async (): Promise<InstallWorkspacePackagesResponse> => {
    const res = await fetch(`${API_BASE}/workspace/packages/install`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to install workspace packages');
    return parseInstallWorkspacePackagesResponse(await readJson(res));
  };

  const upProjectInfrastructure = async (
    projectId: string,
  ): Promise<UpProjectInfrastructureResponse> => {
    const res = await fetch(`${API_BASE}/projects/${projectId}/infra/up`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to reload project infrastructure');
    return parseUpProjectInfrastructureResponse(await readJson(res));
  };

  const launchProject = async (projectId: string): Promise<LaunchProjectResponse> => {
    const res = await fetch(`${API_BASE}/projects/${projectId}/launch`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to launch project');
    return parseLaunchProjectResponse(await readJson(res));
  };

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  return {
    projects,
    isLoading,
    error,
    refresh: fetchProjects,
    createProject,
    deleteProject,
    syncProject,
    installWorkspacePackages,
    upProjectInfrastructure,
    launchProject,
  };
};
