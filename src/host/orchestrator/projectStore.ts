import type { AppManifest, ThemeConfig } from '@ankhorage/contracts';
import { promises as fs } from 'fs';
import path from 'path';

import { isAppManifest } from '../../contractGuards';
import type { StudioProjectSummary } from '../../projectWorkspaceContracts';
import { getProjectPath } from './projectPaths';

export type ProjectSummary = StudioProjectSummary;

export class ProjectManifestNotFoundError extends Error {
  constructor(projectId: string) {
    super(`Project '${projectId}' is missing canonical ankh.config.json.`);
    this.name = 'ProjectManifestNotFoundError';
  }
}

export class ProjectStore {
  constructor(private readonly rootPath: string) {}

  private getProjectPath(projectId: string) {
    return getProjectPath(this.rootPath, projectId);
  }

  private getManifestPath(projectId: string) {
    return path.join(this.getProjectPath(projectId), 'ankh.config.json');
  }

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

  async deleteProject(projectId: string) {
    const projectPath = this.getProjectPath(projectId);
    await fs.rm(projectPath, { recursive: true, force: true });
    return true;
  }

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

  async writeManifest(projectId: string, manifest: AppManifest): Promise<AppManifest> {
    const projectPath = this.getProjectPath(projectId);
    if (!(await exists(projectPath))) {
      throw new Error(`Project '${projectId}' not found.`);
    }

    const updated = normalizeManifestForProject(projectId, manifest);
    await writeJsonAtomic(this.getManifestPath(projectId), updated);
    return updated;
  }

  async mutateManifest(
    projectId: string,
    updater: (manifest: AppManifest) => AppManifest,
  ): Promise<AppManifest> {
    const current = await this.readManifest(projectId);
    return this.writeManifest(projectId, updater(current));
  }

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

function parseProjectSummaryManifest(value: unknown): AppManifest {
  if (!isAppManifest(value)) {
    throw new Error('Project manifest does not contain canonical Studio metadata.');
  }

  return value;
}

function parseReadableAppManifest(value: unknown): AppManifest {
  if (!isAppManifest(value)) {
    throw new Error('Project manifest is not a canonical AppManifest.');
  }

  return value;
}

function resolveActiveTheme(manifest: AppManifest): ThemeConfig {
  const activeTheme = manifest.themes.find((theme) => theme.id === manifest.activeThemeId);
  if (!activeTheme) {
    throw new Error(`Manifest active theme '${manifest.activeThemeId}' is missing.`);
  }

  return activeTheme;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(temporaryPath, filePath);
}
