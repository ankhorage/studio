import type { AppManifest } from '@ankhorage/contracts';
import { type ExpoRuntimePlan, resolveExpoRuntimePlan } from '@ankhorage/expo-runtime/planning';
import { promises as fs } from 'fs';
import path from 'path';

import { LayoutGenerator } from '../layout/layoutGenerator';
import { applySystemTemplates } from '../manifestSystem';
import type { LayoutMutation } from '../modules/layout';
import type { ProjectTemplateSelection } from '../templateRegistry';
import { resolveZoraExtensionsForTemplateSelection } from '../zoraExtensions';
import { syncGeneratedRouteFiles } from './generatedRouteCleanup';
import { getProjectInfrastructureStatus, syncProjectInfrastructure } from './infraGenerator';
import { runProjectInfraScript } from './infraRuntime';
import { cleanupProjectGeneratedAppImage, stopProjectSupabaseContainers } from './projectDeletion';
import { getAppsRoot, getProjectPath } from './projectPaths';
import { ProjectStore, type ProjectSummary } from './projectStore';
import { resolveModuleLayoutMutations } from './resolveMutations';
import { ProjectScaffolder } from './scaffolder';
import type { GeneratedAuthProvider, GeneratedStorageProvider } from './templates';
import { runWorkspaceInstall } from './workspaceRuntime';

export class ProjectManager {
  private readonly store: ProjectStore;
  private readonly scaffolder: ProjectScaffolder;
  private readonly layout: LayoutGenerator;

  private readonly appsRoot: string;

  constructor(private readonly rootPath: string) {
    this.appsRoot = getAppsRoot(rootPath);
    this.store = new ProjectStore(rootPath);
    this.scaffolder = new ProjectScaffolder(rootPath);
    this.layout = new LayoutGenerator();
  }

  // =========================================================================
  //  PROJECT LIFECYCLE (PUBLIC API)
  // =========================================================================

  async listProjects(): Promise<ProjectSummary[]> {
    return this.store.listProjects();
  }

  async deleteProject(projectId: string) {
    const projectPath = getProjectPath(this.rootPath, projectId);
    const warnings: string[] = [];
    let infraDown = false;

    const supabaseCleanup = await stopProjectSupabaseContainers({ projectId });
    warnings.push(...supabaseCleanup.warnings);

    if (await exists(projectPath)) {
      const manifest = await this.store.readManifest(projectId);
      const infraStatus = await getProjectInfrastructureStatus({
        projectId,
        projectPath,
        manifest,
      });

      if (!infraStatus.skipped && infraStatus.hasDeployment && infraStatus.target) {
        // Regenerate once to ensure teardown scripts exist before invoking down lifecycle.
        await syncProjectInfrastructure({
          projectId,
          projectPath,
          manifest,
        });

        try {
          await runProjectInfraScript({
            rootPath: this.rootPath,
            projectId,
            target: infraStatus.target,
            script: 'down',
          });
          infraDown = true;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          warnings.push(`Infrastructure teardown failed: ${message}`);
        }

        const imageCleanup = await cleanupProjectGeneratedAppImage({
          projectPath,
          target: infraStatus.target,
        });
        warnings.push(...imageCleanup.warnings);
      }
    }

    await this.store.deleteProject(projectId);

    return {
      success: true,
      infraDown,
      warnings,
    };
  }

  async createProject(
    name: string,
    templateSelection: ProjectTemplateSelection,
    onProjectCreated?: (projectId: string) => Promise<void>,
    options: { includeStudio?: boolean } = {},
  ) {
    const { includeStudio = true } = options;
    const slug = slugify(name);
    const projectPath = getProjectPath(this.rootPath, slug);

    if (await exists(projectPath)) {
      throw new Error(`Project ID '${slug}' is already taken.`);
    }

    const templateData = this.scaffolder.getTemplate(templateSelection);
    const scaffoldManifest = applySystemTemplates(templateData);
    const zoraExtensions = resolveZoraExtensionsForTemplateSelection(templateSelection);

    // 1) scaffold base project
    await this.scaffolder.scaffoldProject(projectPath, name, slug, {
      includeStudio,
      authProvider: resolveGeneratedAuthProvider(scaffoldManifest),
      runtimePlan: resolveExpoRuntimePlan(scaffoldManifest),
      storageProvider: resolveGeneratedStorageProvider(scaffoldManifest),
      splashScreen: scaffoldManifest.splashScreen ?? null,
      zoraExtensions,
    });

    // 2) layout generation from template + mutations
    // IMPORTANT: ProjectManager no longer resolves module layout mutations itself.
    // The orchestrator should pass mutations when calling rebuild/sync.
    // For creation we default to "no mutations"; your template-driven module installs
    // will run via orchestrator anyway.
    const manifest = await this.scaffolder.finalizeManifest(projectPath, templateData, name, slug);
    const runtimePlan = resolveExpoRuntimePlan(manifest);

    // 3) generate router files based on manifest (no module layout mutations at creation)
    await this.writeGeneratedFiles(projectPath, manifest, [], { includeStudio, runtimePlan });

    // 4) generate infrastructure artifacts from infra manifest
    await syncProjectInfrastructure({
      projectId: slug,
      projectPath,
      manifest,
    });

    // 5) hook for orchestrator (e.g. registry generation)
    if (onProjectCreated) {
      await onProjectCreated(slug);
    }

    return { success: true, id: slug, path: projectPath };
  }

  async installWorkspacePackages() {
    await runWorkspaceInstall(this.rootPath);
    return { success: true };
  }

  // =========================================================================
  //  MANIFEST (PUBLIC API)
  // =========================================================================

  async getProjectManifest(projectId: string): Promise<AppManifest> {
    return this.store.readManifest(projectId);
  }

  async getStudioManifest(projectId: string): Promise<AppManifest> {
    return this.store.readStudioManifest(projectId);
  }

  async updateStudioManifestIfExists(
    projectId: string,
    updater: (manifest: AppManifest) => AppManifest,
  ): Promise<{ updated: boolean }> {
    const hasDraft = await this.store.hasStudioManifest(projectId);
    if (!hasDraft) {
      return { updated: false };
    }

    const current = await this.store.readStudioManifest(projectId);
    const next = updater(current);
    await this.store.writeStudioManifest(projectId, next);
    return { updated: true };
  }

  /**
   * Save manifest and (optionally) regenerate router files immediately.
   *
   * We take `mutations` as input to keep module boundaries clean.
   */
  async saveProjectManifest(args: {
    projectId: string;
    manifest: AppManifest;
    mutations: LayoutMutation[];
    regenerateRouterFiles?: boolean;
  }) {
    const { projectId, manifest, mutations, regenerateRouterFiles = true } = args;

    const projectPath = getProjectPath(this.rootPath, projectId);
    const normalizedManifest = applySystemTemplates(manifest);
    const updated = await this.store.writeManifest(projectId, normalizedManifest);
    await this.store.deleteStudioManifest(projectId);
    const runtimePlan = resolveExpoRuntimePlan(updated);

    if (regenerateRouterFiles) {
      const resolvedIncludeStudio = await this.shouldIncludeStudio(projectPath);
      await this.syncProjectScaffold(
        projectPath,
        projectId,
        updated,
        resolvedIncludeStudio,
        runtimePlan,
      );
      await this.writeGeneratedFiles(projectPath, updated, mutations, {
        includeStudio: resolvedIncludeStudio,
        runtimePlan,
      });
    }

    await syncProjectInfrastructure({
      projectId,
      projectPath,
      manifest: updated,
    });

    return { success: true };
  }

  async saveStudioManifest(args: { projectId: string; manifest: AppManifest }) {
    const { projectId, manifest } = args;
    const normalizedManifest = applySystemTemplates(manifest);
    await this.store.writeStudioManifest(projectId, normalizedManifest);
    return { success: true };
  }

  async syncStudioRuntime(args: { projectId: string; manifest: AppManifest }) {
    const { projectId, manifest } = args;
    const normalizedManifest = applySystemTemplates(manifest);
    const projectPath = getProjectPath(this.rootPath, projectId);
    const includeStudio = await this.shouldIncludeStudio(projectPath);
    const runtimePlan = resolveExpoRuntimePlan(normalizedManifest);

    await this.store.writeStudioManifest(projectId, normalizedManifest);
    await this.syncProjectScaffold(
      projectPath,
      projectId,
      normalizedManifest,
      includeStudio,
      runtimePlan,
    );
    await this.writeGeneratedFiles(
      projectPath,
      normalizedManifest,
      resolveModuleLayoutMutations(normalizedManifest.infra.plugins),
      {
        includeStudio,
        runtimePlan,
      },
    );
    await syncProjectInfrastructure({
      projectId,
      projectPath,
      manifest: normalizedManifest,
    });

    return { success: true };
  }

  /**
   * Rebuild only the root layout file from manifest + mutations.
   */
  async rebuildRootLayout(args: { projectId: string; mutations: LayoutMutation[] }) {
    const { projectId, mutations } = args;

    const manifest = await this.getProjectManifest(projectId);
    const projectPath = getProjectPath(this.rootPath, projectId);
    const runtimePlan = resolveExpoRuntimePlan(manifest);

    const rootOnly = this.layout
      .generateAll(projectPath, manifest, mutations, {
        includeStudio: await this.shouldIncludeStudio(projectPath),
        runtimePlan,
      })
      .filter((f: { path: string }) => f.path === 'src/app/_layout.tsx');

    for (const f of rootOnly) {
      await this.writeText(path.join(projectPath, f.path), f.content);
    }

    return { success: true };
  }

  async syncProject(args: {
    projectId: string;
    mutations: LayoutMutation[];
    includeStudio?: boolean;
  }) {
    const { projectId, mutations, includeStudio } = args;

    const projectPath = getProjectPath(this.rootPath, projectId);
    const hasStudioManifest = await this.store.hasStudioManifest(projectId);
    const manifest = hasStudioManifest
      ? await this.store.readStudioManifest(projectId)
      : await this.getProjectManifest(projectId);
    const normalizedManifest = applySystemTemplates(manifest);
    const resolvedIncludeStudio = await this.shouldIncludeStudio(projectPath, includeStudio);
    const runtimePlan = resolveExpoRuntimePlan(normalizedManifest);

    if (hasStudioManifest || normalizedManifest !== manifest) {
      await this.store.writeManifest(projectId, normalizedManifest);
      await this.store.deleteStudioManifest(projectId);
    }

    await this.syncProjectScaffold(
      projectPath,
      projectId,
      normalizedManifest,
      resolvedIncludeStudio,
      runtimePlan,
    );

    await this.writeGeneratedFiles(projectPath, normalizedManifest, mutations, {
      includeStudio: resolvedIncludeStudio,
      runtimePlan,
    });
    await syncProjectInfrastructure({
      projectId,
      projectPath,
      manifest: normalizedManifest,
    });

    return { success: true };
  }

  async regenerateInfrastructure(projectId: string) {
    const projectPath = getProjectPath(this.rootPath, projectId);
    const manifest = await this.getProjectManifest(projectId);

    return syncProjectInfrastructure({
      projectId,
      projectPath,
      manifest,
    });
  }

  async getInfrastructureStatus(projectId: string) {
    const projectPath = getProjectPath(this.rootPath, projectId);
    const manifest = await this.getProjectManifest(projectId);

    return getProjectInfrastructureStatus({
      projectId,
      projectPath,
      manifest,
    });
  }

  // =========================================================================
  //  LOCALIZATION (PUBLIC API)
  // =========================================================================

  async getLocalizationLocales(projectId: string): Promise<string[]> {
    const localesPath = path.join(
      getProjectPath(this.rootPath, projectId),
      'src/modules/localization/locales',
    );

    if (!(await exists(localesPath))) return [];

    const entries = await fs.readdir(localesPath);
    return entries
      .filter((e) => e.endsWith('.json'))
      .map((e) => e.replace('.json', ''))
      .sort();
  }

  async getLocalizationLocale(projectId: string, locale: string): Promise<Record<string, string>> {
    this.validateLocale(locale);
    const localePath = path.join(
      getProjectPath(this.rootPath, projectId),
      `src/modules/localization/locales/${locale}.json`,
    );

    if (!(await exists(localePath))) return {};

    const content = await fs.readFile(localePath, 'utf8');
    const parsed: unknown = JSON.parse(content);

    if (!isStringRecord(parsed)) {
      throw new Error(`Invalid localization dictionary for locale: ${locale}`);
    }

    return parsed;
  }

  async saveLocalizationLocale(projectId: string, locale: string, dict: Record<string, string>) {
    this.validateLocale(locale);
    const localePath = path.join(
      getProjectPath(this.rootPath, projectId),
      `src/modules/localization/locales/${locale}.json`,
    );

    await this.writeText(localePath, JSON.stringify(dict, null, 2) + '\n');
    return { success: true };
  }

  private validateLocale(locale: string) {
    if (!/^[a-z]{2,3}([-_][a-zA-Z0-9]+)*$/.test(locale)) {
      throw new Error(`Invalid locale format: ${locale}`);
    }
  }

  // =========================================================================
  //  INTERNAL
  // =========================================================================

  private async writeGeneratedFiles(
    projectPath: string,
    manifest: AppManifest,
    mutations: LayoutMutation[],
    options: { includeStudio: boolean; runtimePlan: ExpoRuntimePlan },
  ) {
    const generated = this.layout.generateAll(projectPath, manifest, mutations, {
      includeStudio: options.includeStudio,
      runtimePlan: options.runtimePlan,
    });
    const generatedPaths = generated.map((file) => file.path);

    for (const f of generated) {
      await this.writeText(path.join(projectPath, f.path), f.content);
    }

    await syncGeneratedRouteFiles({
      projectPath,
      generatedPaths,
    });
  }

  private async writeText(absPath: string, content: string) {
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, content, 'utf8');
  }

  private async shouldIncludeStudio(projectPath: string, requested?: boolean) {
    if (requested === false) {
      return false;
    }

    return requested ?? (await exists(path.join(projectPath, 'src/studio')));
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
      runtimePlan,
      storageProvider: resolveGeneratedStorageProvider(manifest),
      splashScreen: manifest.splashScreen ?? null,
    });
  }
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === 'string')
  );
}

function slugify(name: string) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'untitled-app'
  );
}

async function exists(p: string) {
  try {
    await fs.access(p);
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
  if (storage?.provider !== 'auto') {
    return null;
  }

  const usesSupabase = auth?.provider === 'supabase' || database?.provider === 'supabase';
  return usesSupabase ? 'supabase' : null;
}
