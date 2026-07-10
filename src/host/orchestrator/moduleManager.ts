import { createOrchestrator, type Orchestrator } from '@ankhorage/orchestrator';
import path from 'path';

import {
  type HostManifest,
  type HostModuleDefinition,
  listHostModules,
  MODULE_CATALOG,
} from '../modules/catalog';
import { LocalFsTargetAdapter } from '../modules/runtime/LocalFsTargetAdapter';
import { ProjectManager } from './projectManager';
import { resolveModuleLayoutMutations } from './resolveMutations';

interface PendingOperation {
  type: 'uninstall';
  moduleId: string;
  at: string;
}

interface PendingOpsData {
  ops: PendingOperation[];
}

const PENDING_OPS_FILE = '.ankh/pending.json';

const MANAGED_MODULE_DIRS = {
  'expo-localization': 'src/modules/localization',
  'expo-google-fonts': 'src/modules/google-fonts',
} as const;

/**
 * ModuleManager remains the host boundary for bridge and CLI routes.
 * Internally it operates only on orchestrator-backed host modules.
 */
export class ModuleManager {
  private readonly appsRoot: string;
  private readonly projectManager: ProjectManager;
  private readonly adapter: LocalFsTargetAdapter;
  private readonly orchestratorsByAppRoot = new Map<string, Orchestrator>();

  constructor(rootPath: string) {
    this.appsRoot = path.join(rootPath, 'apps');
    this.projectManager = new ProjectManager(rootPath);
    this.adapter = new LocalFsTargetAdapter();
  }

  getAvailableModules() {
    return listHostModules().map((module) => ({
      id: module.id,
      name: module.name,
      description: module.description,
      ui: module.ui,
    }));
  }

  async proxyGet(moduleId: string, requestPath: string) {
    const module = this.getModule(moduleId);
    if (!module.proxyGet) {
      throw new Error(`Module '${moduleId}' does not support proxyGet.`);
    }
    return await module.proxyGet(requestPath);
  }

  async installModule(projectId: string, moduleId: string, config?: unknown) {
    const appPath = this.getAppPath(projectId);
    await this.ensureProjectExists(projectId);

    const manifest = await this.readManifest(appPath);
    const module = this.getModule(moduleId);
    const resolvedConfig =
      config === undefined
        ? module.readStoredConfig(manifest)
        : this.requirePlainObject(config, moduleId);
    const validatedConfig = this.validateModuleConfig(module, resolvedConfig);

    const orchestrator = this.getModuleOrchestrator(appPath);
    await orchestrator.installModule(moduleId, {
      config: validatedConfig,
    });

    await this.removePendingOperation(appPath, moduleId);

    const nextManifest = this.applyInstalledModuleState(manifest, moduleId, validatedConfig);
    await this.writeManifest(appPath, nextManifest);
    await this.projectManager.updateStudioManifestIfExists(projectId, (draft) =>
      this.applyInstalledModuleState(draft, moduleId, validatedConfig),
    );
    await this.rebuildRootLayout(projectId);
    await this.generateModuleRegistry(projectId);

    return { success: true, moduleId };
  }

  async uninstallModule(projectId: string, moduleId: string) {
    const appPath = this.getAppPath(projectId);
    await this.ensureProjectExists(projectId);

    const manifest = await this.readManifest(appPath);
    const pendingData = await this.readPending(appPath);
    const hasPendingUninstall = pendingData.ops.some((op) => op.moduleId === moduleId);

    if (!manifest.infra.plugins.includes(moduleId)) {
      if (hasPendingUninstall) {
        return { success: true, needsReload: true, pending: true };
      }
      return {
        success: false,
        needsReload: false,
        error: `Module '${moduleId}' is not installed.`,
      };
    }

    await this.enqueuePending(appPath, {
      type: 'uninstall',
      moduleId,
      at: new Date().toISOString(),
    });

    const nextManifest = this.applyUninstalledModuleState(manifest, moduleId);
    await this.writeManifest(appPath, nextManifest);
    await this.projectManager.updateStudioManifestIfExists(projectId, (draft) =>
      this.applyUninstalledModuleState(draft, moduleId),
    );
    await this.rebuildRootLayout(projectId);
    await this.generateModuleRegistry(projectId);

    return { success: true, needsReload: true };
  }

  async applyPendingOperations(projectId: string) {
    const appPath = this.getAppPath(projectId);
    const pendingData = await this.readPending(appPath);
    if (pendingData.ops.length === 0) {
      return { success: true, applied: 0 };
    }

    const orchestrator = this.getModuleOrchestrator(appPath);
    for (const op of pendingData.ops) {
      // Pending ops should be safe to apply repeatedly (e.g. after partial cleanups).
      try {
        await orchestrator.removeModule(op.moduleId);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        // If module is already absent, continue cleanup without failing the whole finalize step.
        if (!message.toLowerCase().includes('not installed')) {
          throw error;
        }
      }
      await this.removeManagedModuleDir(appPath, op.moduleId);
      await this.projectManager.updateStudioManifestIfExists(projectId, (draft) =>
        this.applyUninstalledModuleState(draft, op.moduleId),
      );
    }

    await this.clearPending(appPath);
    await this.rebuildRootLayout(projectId);
    await this.generateModuleRegistry(projectId);

    return { success: true, applied: pendingData.ops.length };
  }

  async finalizeUninstalls(projectId: string) {
    return this.applyPendingOperations(projectId);
  }

  async generateModuleRegistry(projectId: string) {
    const appPath = this.getAppPath(projectId);
    const content = `/* generated by @ankhorage/studio */
export const MODULE_PANEL_LOADERS: Record<string, () => Promise<unknown>> = {};
`;

    const registryPath = path.join(appPath, 'src/modules/registry.ts');
    await this.adapter.ensureDir(path.dirname(registryPath));
    await this.adapter.writeText(registryPath, content);
  }

  async pruneDependencies(_appPath: string) {
    // Dependency cleanup is handled by orchestrator.removeModule().
  }

  async syncProject(args: { projectId: string; includeStudio?: boolean }) {
    const { projectId, includeStudio = true } = args;
    await this.ensureProjectExists(projectId);
    await this.applyPendingOperations(projectId);

    const mutations = await this.resolveLayoutMutations(projectId);
    const result = await this.projectManager.syncProject({ projectId, mutations, includeStudio });
    await this.generateModuleRegistry(projectId);
    return result;
  }

  async rebuildRootLayout(projectId: string) {
    await this.ensureProjectExists(projectId);
    const mutations = await this.resolveLayoutMutations(projectId);
    return this.projectManager.rebuildRootLayout({ projectId, mutations });
  }

  async updateModuleConfig(projectId: string, moduleId: string, config: unknown) {
    const appPath = this.getAppPath(projectId);
    await this.ensureProjectExists(projectId);

    const manifest = await this.readManifest(appPath);
    if (!manifest.infra.plugins.includes(moduleId)) {
      throw new Error(`Module '${moduleId}' is not installed.`);
    }

    const module = this.getModule(moduleId);
    const validatedConfig = this.validateModuleConfig(
      module,
      this.requirePlainObject(config, moduleId),
    );

    const orchestrator = this.getModuleOrchestrator(appPath);
    await orchestrator.installModule(moduleId, {
      config: validatedConfig,
    });
    await this.removePendingOperation(appPath, moduleId);

    const nextManifest = this.applyInstalledModuleState(manifest, moduleId, validatedConfig);
    await this.writeManifest(appPath, nextManifest);
    await this.projectManager.updateStudioManifestIfExists(projectId, (draft) =>
      this.applyInstalledModuleState(draft, moduleId, validatedConfig),
    );
    await this.rebuildRootLayout(projectId);
    await this.generateModuleRegistry(projectId);

    return {
      success: true,
      ankhConfig: nextManifest,
      installedModules: [...nextManifest.infra.plugins],
      needsReload: false,
    };
  }

  private getModule(moduleId: string): HostModuleDefinition {
    const module = MODULE_CATALOG[moduleId];
    if (!module) {
      throw new Error(`Module '${moduleId}' not found in catalog.`);
    }
    return module;
  }

  private getModuleOrchestrator(appPath: string): Orchestrator {
    const cached = this.orchestratorsByAppRoot.get(appPath);
    if (cached) {
      return cached;
    }

    const orchestrator = createOrchestrator({
      modules: listHostModules().map((module) => module.definition),
      projectRoot: appPath,
    });
    this.orchestratorsByAppRoot.set(appPath, orchestrator);
    return orchestrator;
  }

  private getAppPath(projectId: string) {
    return path.join(this.appsRoot, projectId);
  }

  private async ensureProjectExists(projectId: string) {
    const appPath = this.getAppPath(projectId);
    if (!(await this.adapter.exists(appPath))) {
      throw new Error(`Project '${projectId}' not found at ${appPath}`);
    }
  }

  private async resolveLayoutMutations(projectId: string) {
    const manifest = await this.readManifest(this.getAppPath(projectId));
    return resolveModuleLayoutMutations(manifest.infra.plugins);
  }

  private async readManifest(appPath: string): Promise<HostManifest> {
    const manifestPath = path.join(appPath, 'ankh.config.json');
    const manifest = await this.adapter.readJson<HostManifest>(manifestPath);
    if (!manifest) {
      throw new Error(`Manifest not found at ${manifestPath}`);
    }
    return manifest;
  }

  private async writeManifest(appPath: string, manifest: HostManifest) {
    await this.adapter.writeJson(path.join(appPath, 'ankh.config.json'), manifest);
  }

  private applyInstalledModuleState(
    manifest: HostManifest,
    moduleId: string,
    config: Record<string, unknown>,
  ): HostManifest {
    const module = this.getModule(moduleId);
    const normalizedConfig = module.normalizeConfig(config);
    const modulesConfig = {
      ...(manifest.infra.modulesConfig ?? {}),
      [moduleId]: normalizedConfig,
    };
    const nextModules = Array.from(new Set([...manifest.infra.plugins, moduleId])).sort(
      (left, right) => left.localeCompare(right),
    );

    const nextManifest = module.applyManifestConfig(manifest, normalizedConfig);
    return {
      ...nextManifest,
      infra: {
        ...nextManifest.infra,
        plugins: nextModules,
        modulesConfig,
      },
    };
  }

  private applyUninstalledModuleState(manifest: HostManifest, moduleId: string): HostManifest {
    const nextModulesConfig = manifest.infra.modulesConfig
      ? Object.fromEntries(
          Object.entries(manifest.infra.modulesConfig).filter((entry) => entry[0] !== moduleId),
        )
      : undefined;

    return {
      ...manifest,
      infra: {
        ...manifest.infra,
        plugins: manifest.infra.plugins.filter((id) => id !== moduleId),
        modulesConfig: nextModulesConfig,
      },
    };
  }

  private requirePlainObject(config: unknown, moduleId: string): Record<string, unknown> {
    if (!isRecord(config)) {
      throw new Error(`Invalid config for module '${moduleId}': must be a plain object.`);
    }
    return config;
  }

  private validateModuleConfig(
    module: HostModuleDefinition,
    config: Record<string, unknown>,
  ): Record<string, unknown> {
    try {
      JSON.stringify(config);
    } catch {
      throw new Error(`Invalid config for module '${module.id}': must be JSON serializable.`);
    }

    return module.normalizeConfig(config);
  }

  private async removeManagedModuleDir(appPath: string, moduleId: string) {
    if (!isManagedModuleId(moduleId)) {
      return;
    }

    await this.adapter.remove(path.join(appPath, MANAGED_MODULE_DIRS[moduleId]));
  }

  private async readPending(appPath: string): Promise<PendingOpsData> {
    const fullPath = path.join(appPath, PENDING_OPS_FILE);
    if (!(await this.adapter.exists(fullPath))) {
      return { ops: [] };
    }
    return (await this.adapter.readJson<PendingOpsData>(fullPath)) ?? { ops: [] };
  }

  private async writePending(appPath: string, data: PendingOpsData) {
    const fullPath = path.join(appPath, PENDING_OPS_FILE);
    await this.adapter.ensureDir(path.dirname(fullPath));
    await this.adapter.writeJson(fullPath, data);
  }

  private async enqueuePending(appPath: string, op: PendingOperation) {
    const data = await this.readPending(appPath);
    if (data.ops.some((pending) => pending.moduleId === op.moduleId)) {
      return;
    }
    data.ops.push(op);
    await this.writePending(appPath, data);
  }

  private async removePendingOperation(appPath: string, moduleId: string) {
    const data = await this.readPending(appPath);
    const next = data.ops.filter((op) => op.moduleId !== moduleId);
    if (next.length === data.ops.length) {
      return;
    }

    if (next.length === 0) {
      await this.clearPending(appPath);
      return;
    }

    await this.writePending(appPath, { ops: next });
  }

  private async clearPending(appPath: string) {
    const fullPath = path.join(appPath, PENDING_OPS_FILE);
    if (await this.adapter.exists(fullPath)) {
      await this.adapter.remove(fullPath);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isManagedModuleId(moduleId: string): moduleId is keyof typeof MANAGED_MODULE_DIRS {
  return Object.prototype.hasOwnProperty.call(MANAGED_MODULE_DIRS, moduleId);
}
