import type { AppManifest, ThemeConfig } from '@ankhorage/contracts';
import { pathExists, writeJsonFileAtomic } from '@ankhorage/utility/node/fs';
import { promises as fs } from 'fs';
import path from 'path';

import { isAppManifest } from '../../contractGuards';
import type { StudioProjectSummary } from '../../projectWorkspaceContracts';
import { getProjectPath } from './projectPaths';

export type ProjectSummary = StudioProjectSummary;

/*** Signal that a project directory exists but its canonical ankh.config.json manifest is missing. */
export class ProjectManifestNotFoundError extends Error {
  /*** Create a missing-manifest error with the affected project id. */
  constructor(projectId: string) {
    super(`Project '${projectId}' is missing canonical ankh.config.json.`);
    this.name = 'ProjectManifestNotFoundError';
  }
}

/***
 * Persist and project Studio project manifests under one workspace root.
 * @todo Move project persistence from host/orchestrator into the projects domain and expose filesystem access through a project persistence port/adapter.
 */
export class ProjectStore {
  /*** Bind project persistence to one Studio workspace root. */
  constructor(private readonly rootPath: string) {}

  /*** Resolve one project directory from the store workspace root and project id. */
  private getProjectPath(projectId: string) {
    return getProjectPath(this.rootPath, projectId);
  }

  /*** Resolve the canonical ankh.config.json path for one project. */
  private getManifestPath(projectId: string) {
    return path.join(this.getProjectPath(projectId), 'ankh.config.json');
  }

  /*** List readable Studio project summaries from workspace app directories, ignoring invalid/incomplete projects. */
  async listProjects(): Promise<ProjectSummary[]> {
    const appsRoot = path.join(this.rootPath, 'apps');
    try {
      const entries = await fs.readdir(appsRoot, { withFileTypes: true });
      const dirs = entries
        .filter((entry) => entry.isDirectory() && entry.name !== 'studio')
        .map((entry) => entry.name);

      const results = await Promise.all(
        dirs.map(async (id): Promise<ProjectSummary | null> => this.readProjectSummary(id)),
      );
      return results.filter((project): project is ProjectSummary => project !== null);
    } catch {
      return [];
    }
  }

  /*** Remove one project directory recursively from the workspace. */
  async deleteProject(projectId: string) {
    const projectPath = this.getProjectPath(projectId);
    await fs.rm(projectPath, { recursive: true, force: true });
    return true;
  }

  /*** Read and validate one project's canonical AppManifest, distinguishing missing project and missing manifest states. */
  async readManifest(projectId: string): Promise<AppManifest> {
    const projectPath = this.getProjectPath(projectId);
    const manifestPath = this.getManifestPath(projectId);

    if (!(await pathExists(projectPath))) {
      throw new Error(`Project '${projectId}' not found.`);
    }

    if (await pathExists(manifestPath)) {
      return parseReadableAppManifest(JSON.parse(await fs.readFile(manifestPath, 'utf8')));
    }

    throw new ProjectManifestNotFoundError(projectId);
  }

  /*** Normalize project-owned metadata and atomically persist one canonical AppManifest. */
  async writeManifest(projectId: string, manifest: AppManifest): Promise<AppManifest> {
    const projectPath = this.getProjectPath(projectId);
    if (!(await pathExists(projectPath))) {
      throw new Error(`Project '${projectId}' not found.`);
    }

    const updated = normalizeManifestForProject(projectId, manifest);
    await writeJsonFileAtomic(this.getManifestPath(projectId), updated);
    return updated;
  }

  /*** Read, transform and persist one project manifest through a caller-supplied manifest updater. */
  async mutateManifest(
    projectId: string,
    updater: (manifest: AppManifest) => AppManifest,
  ): Promise<AppManifest> {
    const current = await this.readManifest(projectId);
    return this.writeManifest(projectId, updater(current));
  }

  /*** Read one project directory into the workspace summary projection, returning null for incomplete or invalid projects. */
  private async readProjectSummary(id: string): Promise<ProjectSummary | null> {
    try {
      const projectPath = getProjectPath(this.rootPath, id);
      if (!(await pathExists(path.join(projectPath, 'package.json')))) return null;
      const manifestPath = path.join(projectPath, 'ankh.config.json');
      if (!(await pathExists(manifestPath))) return null;
      const manifest = parseProjectSummaryManifest(
        JSON.parse(await fs.readFile(manifestPath, 'utf8')),
      );
      const activeTheme = resolveActiveTheme(manifest);
      return {
        id,
        name: manifest.metadata.name,
        path: projectPath,
        version: manifest.metadata.version,
        isAnkhApp: true,
        category: manifest.metadata.category,
        created: manifest.metadata.created,
        updated: manifest.metadata.updated,
        activeTheme,
        activeThemeMode: manifest.activeThemeMode,
      };
    } catch {
      return null;
    }
  }
}

/*** Normalize mutable project-owned manifest metadata before persistence. */
function normalizeManifestForProject(projectId: string, manifest: AppManifest): AppManifest {
  return {
    ...manifest,
    metadata: {
      ...manifest.metadata,
      slug: projectId,
      updated: new Date().toISOString(),
    },
  };
}

/*** Validate one manifest before projecting it into a project summary. */
function parseProjectSummaryManifest(value: unknown): AppManifest {
  if (!isAppManifest(value)) {
    throw new Error('Project manifest does not contain canonical Studio metadata.');
  }

  return value;
}

/*** Validate one manifest before exposing it through the ProjectStore. */
function parseReadableAppManifest(value: unknown): AppManifest {
  if (!isAppManifest(value)) {
    throw new Error('Project manifest is not a canonical AppManifest.');
  }

  return value;
}

/*** Resolve the active theme referenced by one project manifest. */
function resolveActiveTheme(manifest: AppManifest): ThemeConfig {
  const activeTheme = manifest.themes.find((theme) => theme.id === manifest.activeThemeId);
  if (!activeTheme) {
    throw new Error(`Manifest active theme '${manifest.activeThemeId}' is missing.`);
  }

  return activeTheme;
}
