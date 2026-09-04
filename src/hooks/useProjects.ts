import type { AppCategory, AppManifest, ThemeConfig } from '@ankhorage/contracts';
import { useCallback, useEffect, useState } from 'react';

import { isAppCategory, isColorHarmony } from '../contractGuards';
import { API_BASE } from '../core/constants';
import type {
  ProjectCreationValidationFailure,
  StudioProjectSummary,
} from '../projectWorkspaceContracts';

export interface CreateProjectResponse {
  success: boolean;
  id: string;
  path: string;
}

export interface SyncProjectResponse {
  success: boolean;
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
  category: AppCategory;
  slug: string;
  name: string;
}

export class ProjectCreationError extends Error {
  constructor(readonly reason: ProjectCreationValidationFailure) {
    super(reason.message);
    this.name = 'ProjectCreationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isThemeModeConfig(value: unknown): value is ThemeConfig['light'] {
  return isRecord(value) && typeof value.primaryColor === 'string' && isColorHarmony(value.harmony);
}

function isThemeConfig(value: unknown): value is ThemeConfig {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isThemeModeConfig(value.light) &&
    isThemeModeConfig(value.dark)
  );
}

function isActiveThemeMode(value: unknown): value is AppManifest['activeThemeMode'] {
  return value === 'dark' || value === 'light' || value === undefined;
}

function isProject(value: unknown): value is StudioProjectSummary {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.path === 'string' &&
    typeof value.version === 'string' &&
    typeof value.isAnkhApp === 'boolean' &&
    isAppCategory(value.category) &&
    (value.created === undefined || typeof value.created === 'string') &&
    (value.updated === undefined || typeof value.updated === 'string') &&
    isThemeConfig(value.activeTheme) &&
    isActiveThemeMode(value.activeThemeMode)
  );
}

async function readJson(response: Response): Promise<unknown> {
  return await response.json();
}

async function readError(response: Response): Promise<unknown> {
  try {
    return await readJson(response);
  } catch {
    return null;
  }
}

function parseProjectList(value: unknown): StudioProjectSummary[] {
  if (!Array.isArray(value) || !value.every(isProject)) {
    throw new Error('Projects response was not a valid project list');
  }

  return value;
}

async function requestProjects(): Promise<StudioProjectSummary[]> {
  const response = await fetch(`${API_BASE}/projects`);
  if (!response.ok) throw new Error('Failed to fetch projects');
  return parseProjectList(await readJson(response));
}

function parseCreateProjectResponse(value: unknown): CreateProjectResponse {
  if (
    !isRecord(value) ||
    value.success !== true ||
    typeof value.id !== 'string' ||
    typeof value.path !== 'string'
  ) {
    throw new Error('Create project response was invalid');
  }

  return {
    success: true,
    id: value.id,
    path: value.path,
  };
}

function parseProjectCreationFailure(value: unknown): ProjectCreationValidationFailure | null {
  if (!isRecord(value) || typeof value.code !== 'string' || typeof value.message !== 'string') {
    return null;
  }

  if (
    value.code !== 'empty-name' &&
    value.code !== 'invalid-project-id' &&
    value.code !== 'project-id-exists' &&
    value.code !== 'project-name-exists' &&
    value.code !== 'reserved-project-id'
  ) {
    return null;
  }

  return {
    code: value.code,
    message: value.message,
  };
}

function parseSyncProjectResponse(value: unknown): SyncProjectResponse {
  if (!isRecord(value) || typeof value.success !== 'boolean') {
    throw new Error('Sync response was invalid');
  }

  return { success: value.success };
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
    throw new Error('Open running app response was invalid');
  }

  return {
    success: value.success,
    skipped: typeof value.skipped === 'string' ? value.skipped : undefined,
    target: typeof value.target === 'string' ? value.target : undefined,
    url: typeof value.url === 'string' ? value.url : undefined,
    started: typeof value.started === 'boolean' ? value.started : undefined,
  };
}

async function requestProjectAction<T>(
  path: string,
  options: RequestInit,
  parse: (value: unknown) => T,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, options);
  if (!response.ok) throw new Error(`Project action failed with ${response.status}`);
  return parse(await readJson(response));
}

async function requestCreateProject(input: CreateProjectInput): Promise<CreateProjectResponse> {
  const response = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const reason = parseProjectCreationFailure(await readError(response));
    if (reason) throw new ProjectCreationError(reason);
    throw new Error(`Project creation failed with ${response.status}`);
  }
  return parseCreateProjectResponse(await readJson(response));
}

export function useProjects() {
  const [projects, setProjects] = useState<StudioProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      setProjects(await requestProjects());
      setError(null);
    } catch (caught) {
      console.error(caught);
      setError('Could not connect to the local Studio host. Run `ankh studio dev`.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    let active = true;
    void requestProjects()
      .then((nextProjects) => {
        if (!active) return;
        setProjects(nextProjects);
        setError(null);
      })
      .catch((caught: unknown) => {
        console.error(caught);
        if (!active) return;
        setError('Could not connect to the local Studio host. Run `ankh studio dev`.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const createProject = useCallback(async (input: CreateProjectInput) => {
    return await requestCreateProject(input);
  }, []);

  const deleteProject = useCallback(async (projectId: string) => {
    const response = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectId)}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error(`Project deletion failed with ${response.status}`);
  }, []);

  const syncProject = useCallback(async (projectId: string): Promise<SyncProjectResponse> => {
    return await requestProjectAction(
      `/projects/${encodeURIComponent(projectId)}/sync`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
      parseSyncProjectResponse,
    );
  }, []);

  const upProjectInfrastructure = useCallback(
    async (projectId: string): Promise<UpProjectInfrastructureResponse> => {
      return await requestProjectAction(
        `/projects/${encodeURIComponent(projectId)}/infra/up`,
        { method: 'POST' },
        parseUpProjectInfrastructureResponse,
      );
    },
    [],
  );

  const launchProject = useCallback(async (projectId: string): Promise<LaunchProjectResponse> => {
    return await requestProjectAction(
      `/projects/${encodeURIComponent(projectId)}/launch`,
      { method: 'POST' },
      parseLaunchProjectResponse,
    );
  }, []);

  return {
    projects,
    isLoading,
    error,
    refresh,
    createProject,
    deleteProject,
    syncProject,
    upProjectInfrastructure,
    launchProject,
  };
}
