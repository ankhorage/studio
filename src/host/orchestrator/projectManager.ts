import type { AppManifest } from '@ankhorage/contracts';
import { type ExpoRuntimePlan, resolveExpoRuntimePlan } from '@ankhorage/expo-runtime/planning';
import {
  inspectProjectInfrastructure,
  runProjectInfrastructureLifecycle,
  syncProjectInfrastructure,
} from '@ankhorage/infra/project';
import { promises as fs } from 'fs';
import path from 'path';

import {
  ProjectCreationValidationError,
  validateProjectCreationInput,
} from '../../projectIdentity';
import { resolveGeneratedDatabaseRuntime } from '../generatedDatabaseRuntime';
import { GeneratedAppFileGenerator } from '../layout/layoutGenerator';
import { applySystemTemplates } from '../manifestSystem';
import type { LayoutMutation } from '../modules/layout';
import type { ProjectTemplateSelection } from '../templateRegistry';
import { resolveZoraExtensionsForTemplateSelection } from '../zoraExtensions';
import { syncGeneratedRouteFiles } from './generatedRouteCleanup';
import { readProjectStudioInclusion, writeProjectStudioInclusion } from './projectGenerationState';
import { getAppsRoot, getProjectPath } from './projectPaths';
import { ProjectStore, type ProjectSummary } from './projectStore';
import { createDefaultAppDeployManifest } from './projectTargets';
import { ProjectScaffolder } from './scaffolder';
import type { GeneratedAuthProvider, GeneratedStorageProvider } from './templates';
import { runWorkspaceInstall } from './workspaceRuntime';

interface ProjectManagerDependencies {
  readonly runProjectInfrastructureLifecycle: typeof runProjectInfrastructureLifecycle;
}

export class ProjectManager {
  private readonly store: ProjectStore;
  private readonly scaffolder: ProjectScaffolder;
  private readonly appFiles: GeneratedAppFileGenerator;
  private readonly dependencies: ProjectManagerDependencies;
  private readonly appsRoot: string;

  constructor(
    private readonly rootPath: string,
    dependencies: Partial<ProjectManagerDependencies> = {},
  ) {
    this.appsRoot = getAppsRoot(rootPath);
    this.store = new ProjectStore(rootPath);
    this.scaffolder = new ProjectScaffolder(rootPath);
    this.appFiles = new GeneratedAppFileGenerator();
    this.dependencies = {
      runProjectInfrastructureLifecycle,
      ...dependencies,
    };
  }

  async listProjects(): Promise<ProjectSummary[]> {
    return this.store.listProjects();
  }

  async deleteProject(projectId: string) {
    const projectPath = getProjectPath(this.rootPath, projectId);
    let infraDestroyed = false;

    if (await exists(projectPath)) {
      const manifest = await this.store.readManifest(projectId);
      const infraStatus = await inspectProjectInfrastructure({
        projectId,
        projectPath,
        manifest,
      });

      if (!infraStatus.skipped && infraStatus.hasDeployment && infraStatus.target) {
        await syncProjectInfrastructure({ projectId, projectPath, manifest });
        await this.destroyProjectInfrastructure(projectId, projectPath, infraStatus.target);
        infraDestroyed = true;
      }
    }

    await this.store.deleteProject(projectId);
    return { success: true, infraDestroyed, projectFilesDeleted: true };
  }

  async createProject(
    name: string,
    templateSelection: ProjectTemplateSelection,
    onProjectCreated?: (projectId: string) => Promise<void>,
    options: { includeStudio?: boolean } = {},
  ) {
    const { includeStudio = true } = options;
    const existingProjects = await this.listProjects();
    const validation = validateProjectCreationInput({ name, existingProjects });
    if (!validation.ok) {
      throw new ProjectCreationValidationError(validation.reason);
    }

    const slug = validation.projectId;
    const projectPath = getProjectPath(this.rootPath, slug);
    if (await exists(projectPath)) {
      throw new ProjectCreationValidationError({
        code: 'project-id-exists',
        message: `Project ID '${slug}' already exists.`,
      });
    }

    const templateData = this.scaffolder.getTemplate(templateSelection);
    const deploy = templateData.deploy ?? createDefaultAppDeployManifest(slug);
    const scaffoldManifest = applySystemTemplates({ ...templateData, deploy });
    const zoraExtensions = resolveZoraExtensionsForTemplateSelection(templateSelection);
    await this.scaffolder.scaffoldProject(projectPath, name, slug, {
      includeStudio,
      authProvider: resolveGeneratedAuthProvider(scaffoldManifest),
      databaseRuntimeProvider: resolveGeneratedDatabaseRuntime(scaffoldManifest)?.provider ?? null,
      runtimePlan: resolveExpoRuntimePlan(scaffoldManifest),
      storageProvider: resolveGeneratedStorageProvider(scaffoldManifest),
      splashScreen: scaffoldManifest.splashScreen ?? null,
      targets: deploy.targets,
      zoraExtensions,
    });
    await writeProjectStudioInclusion(projectPath, includeStudio);

    const manifest = await this.scaffolder.finalizeManifest(
      projectPath,
      templateData,
      name,
      slug,
      templateSelection.category,
      deploy,
    );
    const runtimePlan = resolveExpoRuntimePlan(manifest);
    await this.writeGeneratedFiles(projectPath, manifest, [], { includeStudio, runtimePlan });
    await syncProjectInfrastructure({ projectId: slug, projectPath, manifest });
    if (onProjectCreated) await onProjectCreated(slug);
    return { success: true, id: slug, path: projectPath };
  }

  async installWorkspacePackages() {
    await runWorkspaceInstall(this.rootPath);
    return { success: true };
  }

  async getProjectManifest(projectId: string): Promise<AppManifest> {
    return this.store.readManifest(projectId);
  }

  async persistProjectManifest(args: {
    projectId: string;
    manifest: AppManifest;
  }): Promise<AppManifest> {
    const normalizedManifest = applySystemTemplates(args.manifest);
    return this.store.writeManifest(args.projectId, normalizedManifest);
  }

  async saveProjectManifest(args: {
    projectId: string;
    manifest: AppManifest;
    mutations: LayoutMutation[];
    regenerateRouterFiles?: boolean;
  }) {
    const { projectId, manifest, mutations, regenerateRouterFiles = true } = args;
    const updated = await this.persistProjectManifest({ projectId, manifest });
    const projectPath = getProjectPath(this.rootPath, projectId);
    const runtimePlan = resolveExpoRuntimePlan(updated);

    if (regenerateRouterFiles) {
      const includeStudio = await this.shouldIncludeStudio(projectPath);
      await this.syncProjectScaffold(projectPath, projectId, updated, includeStudio, runtimePlan);
      await this.writeGeneratedFiles(projectPath, updated, mutations, {
        includeStudio,
        runtimePlan,
      });
    }

    await syncProjectInfrastructure({ projectId, projectPath, manifest: updated });
    return { success: true };
  }

  async syncProjectRuntime(args: {
    projectId: string;
    mutations: LayoutMutation[];
    includeStudio?: boolean;
  }) {
    const { projectId, mutations, includeStudio } = args;
    const projectPath = getProjectPath(this.rootPath, projectId);
    const manifest = await this.getProjectManifest(projectId);
    const resolvedIncludeStudio = await this.shouldIncludeStudio(projectPath, includeStudio);
    const runtimePlan = resolveExpoRuntimePlan(manifest);

    await this.syncProjectScaffold(
      projectPath,
      projectId,
      manifest,
      resolvedIncludeStudio,
      runtimePlan,
    );
    await this.writeGeneratedFiles(projectPath, manifest, mutations, {
      includeStudio: resolvedIncludeStudio,
      runtimePlan,
    });
    await syncProjectInfrastructure({ projectId, projectPath, manifest });
    return { success: true };
  }

  async rebuildRootLayout(args: { projectId: string; mutations: LayoutMutation[] }) {
    const { projectId, mutations } = args;
    const manifest = await this.getProjectManifest(projectId);
    const projectPath = getProjectPath(this.rootPath, projectId);
    const runtimePlan = resolveExpoRuntimePlan(manifest);
    const rootOnly = this.appFiles
      .generateFiles(projectPath, manifest, mutations, {
        includeStudio: await this.shouldIncludeStudio(projectPath),
        runtimePlan,
      })
      .filter((file: { path: string }) => file.path === 'src/app/_layout.tsx');

    for (const file of rootOnly) {
      await this.writeText(path.join(projectPath, file.path), file.content);
    }
    return { success: true };
  }

  async syncProject(args: {
    projectId: string;
    mutations: LayoutMutation[];
    includeStudio?: boolean;
  }) {
    return this.syncProjectRuntime(args);
  }

  async regenerateInfrastructure(projectId: string) {
    const projectPath = getProjectPath(this.rootPath, projectId);
    const manifest = await this.getProjectManifest(projectId);
    return syncProjectInfrastructure({ projectId, projectPath, manifest });
  }

  async getInfrastructureStatus(projectId: string) {
    const projectPath = getProjectPath(this.rootPath, projectId);
    const manifest = await this.getProjectManifest(projectId);
    return inspectProjectInfrastructure({ projectId, projectPath, manifest });
  }

  private async destroyProjectInfrastructure(
    projectId: string,
    projectPath: string,
    target: string,
  ): Promise<void> {
    try {
      await this.dependencies.runProjectInfrastructureLifecycle({
        projectId,
        projectPath,
        target,
        script: 'destroy',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Infrastructure teardown failed for project '${projectId}': ${message}`, {
        cause: error,
      });
    }
  }

  private async writeGeneratedFiles(
    projectPath: string,
    manifest: AppManifest,
    mutations: LayoutMutation[],
    options: { includeStudio: boolean; runtimePlan: ExpoRuntimePlan },
  ) {
    const generated = this.appFiles.generateFiles(projectPath, manifest, mutations, {
      includeStudio: options.includeStudio,
      runtimePlan: options.runtimePlan,
    });
    const generatedPaths = generated.map((file) => file.path);
    for (const file of generated) {
      await this.writeText(path.join(projectPath, file.path), file.content);
    }
    await syncGeneratedRouteFiles({ projectPath, generatedPaths });
  }

  private async writeText(absPath: string, content: string) {
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, content, 'utf8');
  }

  private async shouldIncludeStudio(projectPath: string, requested?: boolean) {
    return requested ?? (await readProjectStudioInclusion(projectPath));
  }

  private async syncProjectScaffold(
    projectPath: string,
    projectId: string,
    manifest: AppManifest,
    includeStudio: boolean,
    runtimePlan: ExpoRuntimePlan,
  ) {
    await this.scaffolder.syncProjectScaffold(projectPath, manifest.metadata.name, projectId, {
      includeStudio,
      authProvider: resolveGeneratedAuthProvider(manifest),
      databaseRuntimeProvider: resolveGeneratedDatabaseRuntime(manifest)?.provider ?? null,
      runtimePlan,
      storageProvider: resolveGeneratedStorageProvider(manifest),
      splashScreen: manifest.splashScreen ?? null,
      targets: manifest.deploy?.targets,
    });
    await writeProjectStudioInclusion(projectPath, includeStudio);
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function resolveGeneratedAuthProvider(manifest: AppManifest): GeneratedAuthProvider {
  const { auth } = manifest.infra;
  if (auth?.scope === 'global' && auth.provider === 'supabase') {
    return 'supabase';
  }
  return null;
}

function resolveGeneratedStorageProvider(manifest: AppManifest): GeneratedStorageProvider {
  const { auth, database, storage } = manifest.infra;
  if (storage?.provider !== 'auto') return null;
  const usesSupabase = auth?.provider === 'supabase' || database?.provider === 'supabase';
  return usesSupabase ? 'supabase' : null;
}
