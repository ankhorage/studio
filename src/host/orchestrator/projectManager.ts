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
import type { LayoutMutation } from '../modules/layout';
import type { ProjectTemplateSelection } from '../templateRegistry';
import { resolveZoraExtensionsForTemplateSelection } from '../zoraExtensions';
import { GeneratedRouteFileOwnership } from './GeneratedRouteFileOwnership';
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
 * Coordinate Studio project creation, persistence, scaffold generation, runtime sync, and Infrastructure lifecycle.
 * @todo Move this root manager from generic `host/orchestrator` into the `projects/` application domain with explicit host adapters.
 */
export class ProjectManager {
  private readonly store: ProjectStore;
  private readonly scaffolder: ProjectScaffolder;
  private readonly appFiles: GeneratedAppFileGenerator;
  private readonly generatedRouteFiles: GeneratedRouteFileOwnership;
  private readonly dependencies: ProjectManagerDependencies;
  private readonly appsRoot: string;

  /*** Construct the project application coordinator and its current host-side collaborators. */
  constructor(
    private readonly rootPath: string,
    dependencies: Partial<ProjectManagerDependencies> = {},
  ) {
    this.appsRoot = getAppsRoot(rootPath);
    this.store = new ProjectStore(rootPath);
    this.scaffolder = new ProjectScaffolder(rootPath);
    this.appFiles = new GeneratedAppFileGenerator();
    this.generatedRouteFiles = new GeneratedRouteFileOwnership();
    this.dependencies = {
      runProjectInfrastructureLifecycle,
      ...dependencies,
    };
  }

  /*** List current Studio projects through the project store. */
  async listProjects(): Promise<ProjectSummary[]> {
    return this.store.listProjects();
  }

  /*** Tear down deployed Infrastructure when necessary and remove one Studio project. */
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

  /*** Validate, scaffold, finalize, generate, and initialize Infrastructure for a new Studio project. */
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
    await this.writeGeneratedFiles(projectPath, manifest, [], {
      includeStudio,
      operation: 'create',
      runtimePlan,
    });
    await syncProjectInfrastructure({ projectId: slug, projectPath, manifest });
    if (onProjectCreated) await onProjectCreated(slug);
    return { success: true, id: slug, path: projectPath };
  }

  /*** Install workspace package dependencies through the bounded Bun-install runtime helper. */
  async installWorkspacePackages() {
    await runWorkspaceInstall(this.rootPath);
    return { success: true };
  }

  /*** Read one project's canonical manifest. */
  async getProjectManifest(projectId: string): Promise<AppManifest> {
    return this.store.readManifest(projectId);
  }

  /*** Apply system templates and persist one project's canonical manifest without regenerating files. */
  async persistProjectManifest(args: {
    projectId: string;
    manifest: AppManifest;
  }): Promise<AppManifest> {
    const normalizedManifest = applySystemTemplates(args.manifest);
    return this.store.writeManifest(args.projectId, normalizedManifest);
  }

  /*** Persist a manifest, optionally regenerate the current project scaffold/routes, and synchronize Infrastructure. */
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

  /*** Synchronize one generated project's runtime/scaffold from its current canonical manifest. */
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

  /*** Regenerate and write only the root layout while preserving current route ownership. */
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

  /*** Alias the project sync use case to current runtime synchronization. */
  async syncProject(args: {
    projectId: string;
    mutations: LayoutMutation[];
    includeStudio?: boolean;
  }) {
    return this.syncProjectRuntime(args);
  }

  /*** Regenerate one project's Infrastructure from its current canonical manifest. */
  async regenerateInfrastructure(projectId: string) {
    const projectPath = getProjectPath(this.rootPath, projectId);
    const manifest = await this.getProjectManifest(projectId);
    return syncProjectInfrastructure({ projectId, projectPath, manifest });
  }

  /*** Inspect one project's current generated/deployed Infrastructure state. */
  async getInfrastructureStatus(projectId: string) {
    const projectPath = getProjectPath(this.rootPath, projectId);
    const manifest = await this.getProjectManifest(projectId);
    return inspectProjectInfrastructure({ projectId, projectPath, manifest });
  }

  /*** Destroy one project's Infrastructure while preserving lifecycle diagnostics in a Studio error. */
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

  /*** Generate authored app files, write them, and initialize or reconcile route ownership. */
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

  /*** Resolve requested Studio inclusion or fall back to the persisted current generation-state flag. */
  private async shouldIncludeStudio(projectPath: string, requested?: boolean) {
    return requested ?? (await readProjectStudioInclusion(projectPath));
  }

  /*** Synchronize the package scaffold and persist the resolved Studio-inclusion generation state. */
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

/*** Require canonical Deploy targets before a project scaffold can be regenerated. */
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

/*** Resolve the generated Auth runtime provider implied by the canonical project manifest. */
function resolveGeneratedAuthProvider(manifest: AppManifest): GeneratedAuthProvider {
  const { auth } = manifest.infra;
  if (auth?.scope === 'global' && auth.provider === 'supabase') {
    return 'supabase';
  }
  return null;
}

/*** Resolve the generated storage runtime provider implied by canonical Infra configuration. */
function resolveGeneratedStorageProvider(manifest: AppManifest): GeneratedStorageProvider {
  const { auth, database, storage } = manifest.infra;
  if (storage?.provider !== 'auto') return null;
  const usesSupabase = auth?.provider === 'supabase' || database?.provider === 'supabase';
  return usesSupabase ? 'supabase' : null;
}
