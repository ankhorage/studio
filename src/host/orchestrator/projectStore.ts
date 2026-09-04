import type { AppManifest, ThemeConfig } from '@ankhorage/contracts';
import { promises as fs } from 'fs';
import path from 'path';

import { isAppManifest } from '../../contractGuards';
import type { StudioProjectSummary } from '../../projectWorkspaceContracts';
import { getProjectPath } from './projectPaths';

export type ProjectSummary = StudioProjectSummary;

/*** Signal that an existing Studio project is missing its canonical manifest file. */
export class ProjectManifestNotFoundError extends Error {
  /*** Construct the missing-manifest error for one project id. */
  constructor(projectId: string) {
    super(`Project '${projectId}' is missing canonical ankh.config.json.`);
    this.name = 'ProjectManifestNotFoundError';
  }
}

/***
 * Persist and query Studio project manifests and summaries beneath one workspace root.
 * @todo Move project persistence from generic `host/orchestrator` into the `projects/` domain host adapter.
 */
export class ProjectStore {
  /*** Construct the project store for one Studio workspace root. */
  constructor(private readonly rootPath: string) {}

  /*** Resolve one validated Studio project path. */
  private getProjectPath(projectId: string) {
    return getProjectPath(this.rootPath, projectId);
  }

  /*** Resolve the canonical manifest path for one Studio project. */
  private getManifestPath(projectId: string) {
    return path.join(this.getProjectPath(projectId), 'ankh.config.json');
  }

  /*** List valid generated Studio projects by reading canonical manifests from workspace app directories. */
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

  /*** Delete one generated Studio project directory recursively. */
  async deleteProject(projectId: string) {
    const projectPath = this.getProjectPath(projectId);
    await fs.rm(projectPath, { recursive: true, force: true });
    return true;
  }

  /*** Read and validate the canonical manifest for an existing Studio project. */
  async readManifest(projectId: string): Promise<AppManifest> {
    const projectPath = this.getProjectPath(projectId);
    const manifestPath = this.getManifestPath(projectId);

    if (!(await exists(projectPath))) {
      throw new Error(`Project '${projectId}' not found.`);
    }

    if (await exists(manifestPath)) {
      return parseReadableAppManifest(JSON.parse(await fs.readFile(manifestPath, 'utf8')));
    }

    throw new ProjectManifestNotFoundError(projectId);
  }

  /*** Normalize and atomically persist the canonical manifest for an existing Studio project. */
  async writeManifest(projectId: string, manifest: AppManifest): Promise<AppManifest> {
    const projectPath = this.getProjectPath(projectId);
    if (!(await exists(projectPath))) {
      throw new Error(`Project '${projectId}' not found.`);
    }

    const updated = normalizeManifestForProject(projectId, manifest);
    await writeJsonAtomic(this.getManifestPath(projectId), updated);
    return updated;
  }

  /*** Read, immutably update, and persist one project's canonical manifest. */
  async mutateManifest(
    projectId: string,
    updater: (manifest: AppManifest) => AppManifest,
  ): Promise<AppManifest> {
    const current = await this.readManifest(projectId);
    return this.writeManifest(projectId, updater(current));
  }

  /*** Read a project summary only when the package and canonical manifest are both present and valid. */
  private async readProjectSummary(id: string): Promise<ProjectSummary | null> {
    try {
      const projectPath = getProjectPath(this.rootPath, id);
      if (!(await exists(path.join(projectPath, 'package.json')))) return null;
      const manifestPath = path.join(projectPath, 'ankh.config.json');
      if (!(await exists(manifestPath))) return null;
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

/*** Apply project-owned slug and updated timestamp metadata before manifest persistence. */
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

/*** Validate a manifest read for project-summary projection and preserve canonical AppManifest typing. */
function parseProjectSummaryManifest(value: unknown): AppManifest {
  if (!isAppManifest(value)) {
    throw new Error('Project manifest does not contain canonical Studio metadata.');
  }

  return value;
}

/*** Validate a canonical project manifest read from persistent storage. */
function parseReadableAppManifest(value: unknown): AppManifest {
  if (!isAppManifest(value)) {
    throw new Error('Project manifest is not a canonical AppManifest.');
  }

  return value;
}

/*** Resolve the manifest's active theme and reject dangling active-theme ids. */
function resolveActiveTheme(manifest: AppManifest): ThemeConfig {
  const activeTheme = manifest.themes.find((theme) => theme.id === manifest.activeThemeId);
  if (!activeTheme) {
    throw new Error(`Manifest active theme '${manifest.activeThemeId}' is missing.`);
  }

  return activeTheme;
}

/***
 * Return whether a filesystem path exists.
 * @utility @ankhorage/utility/node/fs
 */
async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/***
 * Atomically serialize a value as pretty JSON through a same-directory temporary file.
 * @utility @ankhorage/utility/node/fs
 */
async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(temporaryPath, filePath);
}
