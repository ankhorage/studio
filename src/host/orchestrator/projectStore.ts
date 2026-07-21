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

  private getStudioManifestPath(projectId: string) {
    return path.join(this.getProjectPath(projectId), '.ankh', 'studio.manifest.json');
  }

  async listProjects(): Promise<ProjectSummary[]> {
    const appsRoot = path.join(this.rootPath, 'apps');
    try {
      const entries = await fs.readdir(appsRoot, { withFileTypes: true });
      const dirs = entries
        .filter((entry) => entry.isDirectory() && entry.name !== 'studio')
        .map((entry) => entry.name);

      const results = await Promise.all(
        dirs.map(async (id): Promise<ProjectSummary | null> => {
          try {
            const projectPath = getProjectPath(this.rootPath, id);
            const pkgJsonPath = path.join(projectPath, 'package.json');
            const ankhConfigPath = path.join(projectPath, 'ankh.config.json');

            const hasPkg = await exists(pkgJsonPath);
            if (!hasPkg) return null;

            if (!(await exists(ankhConfigPath))) {
              return null;
            }

            try {
              const manifest = parseProjectSummaryManifest(
                JSON.parse(await fs.readFile(ankhConfigPath, 'utf8')),
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
          } catch {
            // If getProjectPath throws or any other unexpected error occurs for a single project,
            // treat it as an unlistable project and skip it. This preserves robustness:
            // problematic projects are ignored while valid ones are still listed.
            //
            // The outer try/catch still provides a catch-all that returns [] if a
            // top-level failure occurs (e.g. reading the apps directory itself fails).
            return null;
          }
        }),
      );

      // Filter out nulls (skipped projects)
      return results.filter((p): p is ProjectSummary => p !== null);
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

  async readStudioManifest(projectId: string): Promise<AppManifest> {
    const studioManifestPath = this.getStudioManifestPath(projectId);
    if (await exists(studioManifestPath)) {
      return parseReadableAppManifest(JSON.parse(await fs.readFile(studioManifestPath, 'utf8')));
    }

    return this.readManifest(projectId);
  }

  async hasStudioManifest(projectId: string) {
    return exists(this.getStudioManifestPath(projectId));
  }

  async writeManifest(projectId: string, manifest: AppManifest) {
    const projectPath = this.getProjectPath(projectId);
    const manifestPath = this.getManifestPath(projectId);

    if (!(await exists(projectPath))) {
      throw new Error(`Project '${projectId}' not found.`);
    }

    const updated: AppManifest = {
      ...manifest,
      metadata: {
        ...manifest.metadata,
        slug: projectId,
        updated: new Date().toISOString(),
      },
    };

    await writeJsonAtomic(manifestPath, updated);
    return updated;
  }

  async writeStudioManifest(projectId: string, manifest: AppManifest) {
    const projectPath = this.getProjectPath(projectId);
    const studioManifestPath = this.getStudioManifestPath(projectId);

    if (!(await exists(projectPath))) {
      throw new Error(`Project '${projectId}' not found.`);
    }

    const updated: AppManifest = {
      ...manifest,
      metadata: {
        ...manifest.metadata,
        slug: projectId,
        updated: new Date().toISOString(),
      },
    };

    await fs.mkdir(path.dirname(studioManifestPath), { recursive: true });
    await writeJsonAtomic(studioManifestPath, updated);
    return updated;
  }

  async deleteStudioManifest(projectId: string) {
    const studioManifestPath = this.getStudioManifestPath(projectId);
    if (await exists(studioManifestPath)) {
      await fs.rm(studioManifestPath, { force: true });
    }
  }
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

async function exists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function writeJsonAtomic(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(
    temporaryPath,
    `${JSON.stringify(value, null, 2)}
`,
    'utf8',
  );
  await fs.rename(temporaryPath, filePath);
}
