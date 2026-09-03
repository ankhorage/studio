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
  templateId: string;
  name: string;
}

export class ProjectCreationError extends Error {
  /*** Create a project-creation error from the canonical validation failure returned by Studio. */
  constructor(readonly reason: ProjectCreationValidationFailure) {
    super(reason.message);
    this.name = 'ProjectCreationError';
  }
}

/***
 * Return whether an unknown value is any non-null JavaScript object, including arrays.
 * @utility @ankhorage/utility/object
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/***
 * Validate one authored theme-mode configuration.
 * @todo Move reusable ThemeConfig validation beside its contracts/theme owner.
 */
function isThemeModeConfig(value: unknown): value is ThemeConfig['light'] {
  return isRecord(value) && typeof value.primaryColor === 'string' && isColorHarmony(value.harmony);
}

/***
 * Validate an authored ThemeConfig returned in a project summary.
 * @todo Move reusable ThemeConfig validation beside its contracts/theme owner.
 */
function isThemeConfig(value: unknown): value is ThemeConfig {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isThemeModeConfig(value.light) &&
    isThemeModeConfig(value.dark)
  );
}

/***
 * Return whether an unknown value is a supported active theme mode or absence.
 * @todo Move this guard beside the AppManifest theme-mode contract.
 */
function isActiveThemeMode(value: unknown): value is AppManifest['activeThemeMode'] {
  return value === 'dark' || value === 'light' || value === undefined;
}

/*** Validate one project summary returned by the Studio host. */
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

/***
 * Decode a Response body as JSON without applying domain validation.
 * @utility @ankhorage/utility/http
 */
async function readJson(response: Response): Promise<unknown> {
  return await response.json();
}

/***
 * Attempt to decode a Response body as JSON and return null when decoding fails.
 * @utility @ankhorage/utility/http
 */
async function readError(response: Response): Promise<unknown> {
  try {
    return await readJson(response);
  } catch {
    return null;
  }
}

/*** Validate an unknown Studio host payload as a project-summary list. */
function parseProjectList(value: unknown): StudioProjectSummary[] {
  if (!Array.isArray(value) || !value.every(isProject)) {
    throw new Error('Projects response was not a valid project list');
  }

  return value;
}

/***
 * Fetch and validate the current Studio project list.
 * @todo Move concrete project-list HTTP access into the projects package-edge adapter.
 */
async function requestProjects(): Promise<StudioProjectSummary[]> {
  const response = await fetch(`${API_BASE}/projects`);
  if (!response.ok) throw new Error('Failed to fetch projects');
  return parseProjectList(await readJson(response));
}

/*** Validate and normalize the host response after creating a project. */
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

/*** Parse a known project-creation validation failure or return null for an unrelated payload. */
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

/***
 * Validate a generic response carrying a boolean success field.
 * @utility @ankhorage/utility/validation
 */
function parseSyncProjectResponse(value: unknown): SyncProjectResponse {
  if (!isRecord(value) || typeof value.success !== 'boolean') {
    throw new Error('Sync response was invalid');
  }

  return { success: value.success };
}

/*** Validate and normalize the project-infrastructure startup response. */
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

/*** Validate and normalize the response returned when Studio launches a project. */
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

/***
 * Own React project-list state while exposing project create/delete/sync/infra/launch operations.
 * @todo Split project HTTP/application operations from the React hook and move the hook beside the projects UI/application owner.
 */
export const useProjects = () => {
  const [projects, setProjects] = useState<StudioProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /*** Reload the current project list and update hook loading/error state. */
  const loadProjects = useCallback(async () => {
    try {
      const data = await requestProjects();
      setProjects(data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Could not connect to the local Studio host. Run `ankh studio dev`.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /*** Mark the project list as loading and run a fresh load. */
  const refresh = useCallback(async () => {
    setIsLoading(true);
    await loadProjects();
  }, [loadProjects]);

  /*** Create a project through the host API and refresh the project list after success. */
  const createProject = async (input: CreateProjectInput): Promise<CreateProjectResponse> => {
    const res = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const failure = parseProjectCreationFailure(await readError(res));
      if (failure) {
        throw new ProjectCreationError(failure);
      }
      throw new Error('Failed to create project');
    }

    const result = parseCreateProjectResponse(await readJson(res));
    await refresh();
    return result;
  };

  /*** Delete a project through the host API and refresh the list after success. */
  const deleteProject = async (projectId: string) => {
    const res = await fetch(`${API_BASE}/projects/${projectId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete project');
    await refresh();
  };

  /*** Request regeneration/synchronization of one project and validate the success response. */
  const syncProject = async (projectId: string): Promise<SyncProjectResponse> => {
    const res = await fetch(`${API_BASE}/projects/${projectId}/sync`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to sync project');
    return parseSyncProjectResponse(await readJson(res));
  };

  /*** Start infrastructure for one project and normalize the host result. */
  const upProjectInfrastructure = async (
    projectId: string,
  ): Promise<UpProjectInfrastructureResponse> => {
    const res = await fetch(`${API_BASE}/projects/${projectId}/infra/up`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to start project infrastructure');
    return parseUpProjectInfrastructureResponse(await readJson(res));
  };

  /*** Launch one project and normalize the host launch response. */
  const launchProject = async (projectId: string): Promise<LaunchProjectResponse> => {
    const res = await fetch(`${API_BASE}/projects/${projectId}/launch`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to open running app');
    return parseLaunchProjectResponse(await readJson(res));
  };

  useEffect(() => {
    let active = true;
    void requestProjects()
      .then((data) => {
        if (!active) return;
        setProjects(data);
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
};
