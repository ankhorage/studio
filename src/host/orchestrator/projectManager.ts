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
import { GeneratedAppFileGenerator } from '../layout/layoutGenerator';
import { applySystemTemplates } from '../manifestSystem';
import { ProjectBundledMediaService } from '../media/projectBundledMediaService';
import type { LayoutMutation } from '../modules/layout';
import { resolveZoraExtensionsForManifest } from '../zoraExtensions';
import { GeneratedRouteFileOwnership } from './GeneratedRouteFileOwnership';
import type { ProjectCreationSource } from './projectCreationSource';
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

/***
 * Coordinate Studio project lifecycle operations across persistence, scaffolding, generated routes, bundled media and infrastructure synchronization.
 * @todo Move project application orchestration from host/orchestrator to the projects domain; host should remain an adapter/composition edge.
 */
export class ProjectManager {
  private readonly store: ProjectStore;
  private readonly scaffolder: ProjectScaffolder;
  private readonly appFiles: GeneratedAppFileGenerator;
  private readonly generatedRouteFiles: GeneratedRouteFileOwnership;
  private readonly bundledMedia: ProjectBundledMediaService;
  private readonly dependencies: ProjectManagerDependencies;
  private readonly appsRoot: string;

  /*** Construct project lifecycle collaborators for one Studio workspace root, allowing infrastructure lifecycle injection for tests/adapters. */
  constructor(
    private readonly rootPath: string,
    dependencies: Partial<ProjectManagerDependencies> = {},
  ) {
    this.appsRoot = getAppsRoot(rootPath);
    this.store = new ProjectStore(rootPath);
    this.scaffolder = new ProjectScaffolder(rootPath);
    this.appFiles = new GeneratedAppFileGenerator();
    this.generatedRouteFiles = new GeneratedRouteFileOwnership();
    this.bundledMedia = new ProjectBundledMediaService(rootPath);
    this.dependencies = {
      runProjectInfrastructureLifecycle,
      ...dependencies,
    };
  }

  /*** List persisted Studio project summaries for the workspace. */
  async listProjects(): Promise<ProjectSummary[]> {
    return this.store.listProjects();
  }

  /*** Destroy deployed infrastructure when present and then remove the project files from the workspace. */
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

  /*** Validate project identity, scaffold a new app from a source manifest/assets, generate owned files and synchronize infrastructure. */
  async createProject(
    name: string,
    source: ProjectCreationSource,
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

    const templateData = source.manifest;
    const { category } = templateData.metadata;
    const deploy = templateData.deploy ?? createDefaultAppDeployManifest(slug);
    const scaffoldManifest = applySystemTemplates({ ...templateData, deploy });
    const zoraExtensions = resolveZoraExtensionsForManifest(scaffoldManifest);
    await this.scaffolder.scaffoldProject(projectPath, name, slug, {
      includeStudio,
      authProvider: resolveGeneratedAuthProvider(scaffoldManifest),
      runtimePlan: resolveExpoRuntimePlan(scaffoldManifest),
      storageProvider: resolveGeneratedStorageProvider(scaffoldManifest),
      splashScreen: scaffoldManifest.splashScreen ?? null,
      targets: deploy.targets,
      zoraExtensions,
    });
    await writeProjectStudioInclusion(projectPath, includeStudio);

    const materializedTemplate = await this.materializeCreationAssets(
      slug,
      templateData,
      source.assets,
    );
    const manifest = await this.scaffolder.finalizeManifest(
      projectPath,
      materializedTemplate,
      name,
      slug,
      category,
      deploy,
    );
    const runtimePlan = resolveExpoRuntimePlan(manifest);
    await this.writeGeneratedFiles(projectPath, manifest, [], {
      includeStudio,
      operation: 'create',
      runtimePlan,
    });
    await syncProjectInfrastructure({ projectId: slug, projectPath, manifest });
    if (onProjectCreated) await onProjectCreated(slug);
    return { success: true, id: slug, path: projectPath };
  }

  /*** Install packages inside one generated project's own workspace. */
  async installProjectPackages(projectId: string) {
    await runWorkspaceInstall(getProjectPath(this.rootPath, projectId));
    return { success: true, scope: 'project' as const };
  }

  /*** Read one project's canonical persisted manifest. */
  async getProjectManifest(projectId: string): Promise<AppManifest> {
    return this.store.readManifest(projectId);
  }

  /*** Apply system-owned manifest templates and persist the normalized project manifest without regenerating route files. */
  async persistProjectManifest(args: {
    projectId: string;
    manifest: AppManifest;
  }): Promise<AppManifest> {
    const normalizedManifest = applySystemTemplates(args.manifest);
    return this.store.writeManifest(args.projectId, normalizedManifest);
  }

  /*** Persist a project manifest, optionally regenerate current scaffold/router ownership, and synchronize infrastructure. */
  async saveProjectManifest(args: {
    projectId: string;
    manifest: AppManifest;
    mutations: LayoutMutation[];
    regenerateRouterFiles?: boolean;
  }) {
    const { projectId, manifest, mutations, regenerateRouterFiles = true } = args;
    const projectPath = getProjectPath(this.rootPath, projectId);

    if (regenerateRouterFiles) {
      await this.generatedRouteFiles.assertSyncable(projectPath);
      requireProjectDeployTargets(manifest);
    }

    const updated = await this.persistProjectManifest({ projectId, manifest });
    const runtimePlan = resolveExpoRuntimePlan(updated);

    if (regenerateRouterFiles) {
      const includeStudio = await this.shouldIncludeStudio(projectPath);
      await this.syncProjectScaffold(projectPath, projectId, updated, includeStudio, runtimePlan);
      await this.writeGeneratedFiles(projectPath, updated, mutations, {
        includeStudio,
        operation: 'sync',
        runtimePlan,
      });
    }

    await syncProjectInfrastructure({ projectId, projectPath, manifest: updated });
    return { success: true };
  }

  /*** Regenerate current project scaffold/runtime files from the persisted manifest and synchronize infrastructure without changing manifest state. */
  async syncProjectRuntime(args: {
    projectId: string;
    mutations: LayoutMutation[];
    includeStudio?: boolean;
  }) {
    const { projectId, mutations, includeStudio } = args;
    const projectPath = getProjectPath(this.rootPath, projectId);
    const manifest = await this.getProjectManifest(projectId);
    await this.generatedRouteFiles.assertSyncable(projectPath);
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
      operation: 'sync',
      runtimePlan,
    });
    await syncProjectInfrastructure({ projectId, projectPath, manifest });
    return { success: true };
  }

  /*** Regenerate only the root Expo layout from current manifest and layout mutations. */
  async rebuildRootLayout(args: { projectId: string; mutations: LayoutMutation[] }) {
    const { projectId, mutations } = args;
    const manifest = await this.getProjectManifest(projectId);
    const projectPath = getProjectPath(this.rootPath, projectId);
    await this.generatedRouteFiles.assertSyncable(projectPath);
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

  /***
   * Delegate project synchronization to syncProjectRuntime.
   * @todo Remove this compatibility alias and keep one canonical project synchronization operation.
   */
  async syncProject(args: {
    projectId: string;
    mutations: LayoutMutation[];
    includeStudio?: boolean;
  }) {
    return this.syncProjectRuntime(args);
  }

  /*** Regenerate the infrastructure projection for one persisted project manifest. */
  async regenerateInfrastructure(projectId: string) {
    const projectPath = getProjectPath(this.rootPath, projectId);
    const manifest = await this.getProjectManifest(projectId);
    return syncProjectInfrastructure({ projectId, projectPath, manifest });
  }

  /*** Inspect current infrastructure status for one persisted project manifest. */
  async getInfrastructureStatus(projectId: string) {
    const projectPath = getProjectPath(this.rootPath, projectId);
    const manifest = await this.getProjectManifest(projectId);
    return inspectProjectInfrastructure({ projectId, projectPath, manifest });
  }

  /*** Materialize source images through Studio's existing bundled-media path before manifest persistence. */
  private async materializeCreationAssets(
    projectId: string,
    manifest: AppManifest,
    assets: ProjectCreationSource['assets'],
  ): Promise<AppManifest> {
    if (assets.length === 0) return manifest;

    const mediaAssets = { ...(manifest.media?.assets ?? {}) };
    for (const asset of assets) {
      mediaAssets[asset.assetId] = await this.bundledMedia.bundle(projectId, asset);
    }

    return {
      ...manifest,
      media: {
        ...(manifest.media ?? {}),
        assets: mediaAssets,
      },
    };
  }

  /*** Execute infrastructure teardown and wrap provider/lifecycle failures with project context. */
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

  /*** Generate current app files, write them to disk and initialize or reconcile generated-route ownership. */
  private async writeGeneratedFiles(
    projectPath: string,
    manifest: AppManifest,
    mutations: LayoutMutation[],
    options: {
      includeStudio: boolean;
      operation: 'create' | 'sync';
      runtimePlan: ExpoRuntimePlan;
    },
  ) {
    const generated = this.appFiles.generateFiles(projectPath, manifest, mutations, {
      includeStudio: options.includeStudio,
      runtimePlan: options.runtimePlan,
    });
    const generatedPaths = generated.map((file) => file.path);
    for (const file of generated) {
      await this.writeText(path.join(projectPath, file.path), file.content);
    }
    if (options.operation === 'create') {
      await this.generatedRouteFiles.initialize(projectPath, generatedPaths);
    } else {
      await this.generatedRouteFiles.reconcile(projectPath, generatedPaths);
    }
  }

  /***
   * Ensure a text file's parent directory exists and write UTF-8 content.
   * @utility @ankhorage/utility/node/fs
   */
  private async writeText(absPath: string, content: string) {
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, content, 'utf8');
  }

  /*** Resolve whether generated project files should include Studio, preferring an explicit request over persisted generation state. */
  private async shouldIncludeStudio(projectPath: string, requested?: boolean) {
    return requested ?? (await readProjectStudioInclusion(projectPath));
  }

  /*** Synchronize the generated project scaffold against the current manifest/runtime plan and persist Studio inclusion ownership. */
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
      runtimePlan,
      storageProvider: resolveGeneratedStorageProvider(manifest),
      splashScreen: manifest.splashScreen ?? null,
      targets: requireProjectDeployTargets(manifest),
    });
    await writeProjectStudioInclusion(projectPath, includeStudio);
  }
}

/***
 * Require canonical deploy targets before project generation/synchronization.
 * @todo Move deploy-target validation to the deploy/projects domain boundary rather than host/orchestrator.
 */
function requireProjectDeployTargets(manifest: AppManifest) {
  const targets = manifest.deploy?.targets;
  if (!targets) {
    throw new Error(
      `Project '${manifest.metadata.slug}' is missing canonical deploy.targets generation state.`,
    );
  }
  return targets;
}

/***
 * Report whether a filesystem path is accessible.
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

/*** Resolve the generated auth-provider mode from the manifest's global auth infrastructure ownership. */
function resolveGeneratedAuthProvider(manifest: AppManifest): GeneratedAuthProvider {
  const { auth } = manifest.infra;
  if (auth?.scope === 'global' && auth.provider === 'supabase') {
    return 'supabase';
  }
  return null;
}

/*** Resolve the generated storage-provider mode when automatic storage should follow Supabase-owned auth/database infrastructure. */
function resolveGeneratedStorageProvider(manifest: AppManifest): GeneratedStorageProvider {
  const { auth, database, storage } = manifest.infra;
  if (storage?.provider !== 'auto') return null;
  const usesSupabase = auth?.provider === 'supabase' || database?.provider === 'supabase';
  return usesSupabase ? 'supabase' : null;
}
