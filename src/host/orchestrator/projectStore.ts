import type { AppManifest } from '@ankhorage/contracts';
import { promises as fs } from 'fs';
import path from 'path';

import { getProjectPath } from './projectPaths';

export interface ProjectSummary {
  id: string;
  name: string;
  path: string;
  version: string;
  isAnkhApp: boolean;
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

            let name = id;
            let version = '0.0.0';
            let isAnkhApp = false;

            if (await exists(ankhConfigPath)) {
              try {
                const {
                  metadata: { name: metaName, version: metaVersion },
                } = JSON.parse(await fs.readFile(ankhConfigPath, 'utf8')) as AppManifest;
                name = metaName;
                version = metaVersion;
                isAnkhApp = true;
              } catch {
                // ignore invalid json in listing (no side effects!)
              }
            }

            return { id, name, path: projectPath, version, isAnkhApp };
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
      return JSON.parse(await fs.readFile(manifestPath, 'utf8')) as AppManifest;
    }

    return {
      /** @todo e.g. 'plugins' missing, check this and cleanup */
      metadata: { name: projectId, slug: projectId },
      screens: {},
      navigator: { type: 'stack', routes: [{ name: 'index', screenId: 'index' }] },
    } as AppManifest;
  }

  async readStudioManifest(projectId: string): Promise<AppManifest> {
    const studioManifestPath = this.getStudioManifestPath(projectId);
    if (await exists(studioManifestPath)) {
      return JSON.parse(await fs.readFile(studioManifestPath, 'utf8')) as AppManifest;
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
  await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}
`, 'utf8');
  await fs.rename(temporaryPath, filePath);
}
