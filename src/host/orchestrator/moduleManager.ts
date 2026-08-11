import type { AppManifest } from '@ankhorage/contracts';
import { createOrchestrator, type ModuleState, type Orchestrator } from '@ankhorage/orchestrator';
import path from 'path';

import { findNodeInManifest, updateStudioManifestNode } from '../../manifestState';
import type { StudioModuleState } from '../../moduleAdminContracts';
import {
  executeHostModuleAdminRuntime,
  resolveHostModuleAdminRuntime,
  type HostModuleAdminExecutionRequest,
  type HostModuleAdminRuntimeContext,
  type HostModuleManifestFieldMutation,
} from '../modules/adminRuntime';
import {
  getHostModule,
  type HostModuleContribution,
  listHostModules,
  resolveHostModuleAdminContribution,
} from '../modules/catalog';
import { LocalFsTargetAdapter } from '../modules/runtime/LocalFsTargetAdapter';
import { ProjectManager } from './projectManager';
import { resolveModuleLayoutMutations } from './resolveMutations';

interface PendingOperation {
  readonly type: 'uninstall';
  readonly moduleId: string;
  readonly at: string;
}

interface PendingOpsData {
  readonly ops: readonly PendingOperation[];
}

export type HostModuleState = StudioModuleState;

const PENDING_OPS_FILE = '.ankh/pending.json';

/** Generic Studio host adapter over the standalone Orchestrator lifecycle. */
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

  async listModules(projectId: string): Promise<readonly HostModuleState[]> {
    const appPath = this.getAppPath(projectId);
    await this.ensureProjectExists(projectId);
    const [states, pending] = await Promise.all([
      this.getModuleOrchestrator(appPath).listModules(),
      this.readPending(appPath),
    ]);
    const pendingIds = new Set(pending.ops.map((operation) => operation.moduleId));

    return states.map((state) =>
      this.toHostModuleState(state, getHostModule(state.moduleId), pendingIds.has(state.moduleId)),
    );
  }

  async getModuleState(projectId: string, moduleId: string): Promise<HostModuleState | null> {
    const appPath = this.getAppPath(projectId);
    await this.ensureProjectExists(projectId);
    const [state, pending] = await Promise.all([
      this.getModuleOrchestrator(appPath).getModule(moduleId),
      this.readPending(appPath),
    ]);
    if (!state) return null;

    return this.toHostModuleState(
      state,
      getHostModule(moduleId),
      pending.ops.some((operation) => operation.moduleId === moduleId),
    );
  }

  async installModule(projectId: string, moduleId: string, config?: unknown) {
    await this.prepareProjectForLifecycle(projectId);
    const appPath = this.getAppPath(projectId);
    const contribution = this.requireHostModule(moduleId);
    const orchestrator = this.getModuleOrchestrator(appPath);
    const current = await orchestrator.getModule(moduleId);
    if (current?.installed) {
      throw new Error(`Module '${moduleId}' is already installed.`);
    }

    const normalizedConfig = this.normalizeConfig(contribution, config ?? {});
    const result = await orchestrator.installModule(moduleId, { config: normalizedConfig });
    await this.removePendingOperation(appPath, moduleId);
    await this.persistLifecycleProjection(projectId);

    return {
      success: true,
      installed: result.installed,
      module: await this.getModuleState(projectId, moduleId),
      needsReload: false,
    };
  }

  async uninstallModule(projectId: string, moduleId: string) {
    await this.prepareProjectForLifecycle(projectId);
    const appPath = this.getAppPath(projectId);
    const state = await this.getModuleOrchestrator(appPath).getModule(moduleId);
    if (!state?.installed) {
      throw new Error(`Module '${moduleId}' is not installed.`);
    }
    if (state.installation.dependents.length > 0) {
      throw new Error(
        `Cannot remove '${moduleId}' while installed modules still depend on it: ${state.installation.dependents.join(', ')}`,
      );
    }

    await this.enqueuePending(appPath, {
      type: 'uninstall',
      moduleId,
      at: new Date().toISOString(),
    });
    await this.rebuildRootLayout(projectId);

    return {
      success: true,
      module: await this.getModuleState(projectId, moduleId),
      needsReload: true,
      pending: true,
    };
  }

  async updateModuleConfig(projectId: string, moduleId: string, config: unknown) {
    await this.prepareProjectForLifecycle(projectId);
    const appPath = this.getAppPath(projectId);
    const contribution = this.requireHostModule(moduleId);
    const orchestrator = this.getModuleOrchestrator(appPath);
    const current = await orchestrator.getModule(moduleId);
    if (!current?.installed) {
      throw new Error(`Module '${moduleId}' is not installed.`);
    }

    const normalizedConfig = this.normalizeConfig(contribution, config);
    const result = await orchestrator.reconfigureModule(moduleId, { config: normalizedConfig });
    await this.removePendingOperation(appPath, moduleId);
    await this.persistLifecycleProjection(projectId);

    return {
      success: true,
      installed: result.installed,
      reconfigured: result.reconfigured,
      module: await this.getModuleState(projectId, moduleId),
      needsReload: false,
    };
  }

  async executeModuleAdminOperation(
    projectId: string,
    moduleId: string,
    request: HostModuleAdminExecutionRequest,
  ) {
    const appPath = this.getAppPath(projectId);
    await this.ensureProjectExists(projectId);
    const contribution = this.requireHostModule(moduleId);
    const runtime = resolveHostModuleAdminRuntime(contribution.adminRuntime);
    if (!runtime) {
      throw new Error(`Module '${moduleId}' does not provide a valid admin runtime.`);
    }

    const state = await this.getModuleState(projectId, moduleId);
    if (!state?.installed) throw new Error(`Module '${moduleId}' is not installed.`);
    if (state.pendingRemoval) {
      throw new Error(`Module '${moduleId}' is pending removal and cannot be administered.`);
    }

    const context = this.createModuleAdminRuntimeContext(
      projectId,
      moduleId,
      appPath,
      request.componentMeta,
    );
    const result = await executeHostModuleAdminRuntime({ runtime, context, request });
    return { success: true, result };
  }

  async applyPendingOperations(projectId: string) {
    const appPath = this.getAppPath(projectId);
    await this.ensureProjectExists(projectId);
    const pending = await this.readPending(appPath);
    if (pending.ops.length === 0) {
      return { success: true, applied: 0 };
    }

    await this.projectManager.syncProject({
      projectId,
      mutations: await this.resolveLayoutMutations(projectId),
    });

    const orchestrator = this.getModuleOrchestrator(appPath);
    let applied = 0;
    for (const operation of pending.ops) {
      const state = await orchestrator.getModule(operation.moduleId);
      if (state?.installed) {
        await orchestrator.removeModule(operation.moduleId);
        applied += 1;
      }
    }

    await this.clearPending(appPath);
    await this.persistLifecycleProjection(projectId);
    return { success: true, applied };
  }

  async syncProject(args: { projectId: string; includeStudio?: boolean }) {
    const { projectId, includeStudio = true } = args;
    await this.ensureProjectExists(projectId);
    await this.applyPendingOperations(projectId);
    return await this.projectManager.syncProject({
      projectId,
      mutations: await this.resolveLayoutMutations(projectId),
      includeStudio,
    });
  }

  async saveStudioManifest(args: { projectId: string; manifest: AppManifest }) {
    await this.ensureProjectExists(args.projectId);
    return await this.projectManager.saveStudioManifest({
      ...args,
      manifest: await this.projectLifecycleState(args.projectId, args.manifest),
    });
  }

  async syncStudioRuntime(args: { projectId: string; manifest: AppManifest }) {
    await this.ensureProjectExists(args.projectId);
    return await this.projectManager.syncStudioRuntime({
      ...args,
      manifest: await this.projectLifecycleState(args.projectId, args.manifest),
      mutations: await this.resolveLayoutMutations(args.projectId),
    });
  }

  async saveProjectManifest(args: { projectId: string; manifest: AppManifest }) {
    await this.ensureProjectExists(args.projectId);
    return await this.projectManager.saveProjectManifest({
      ...args,
      manifest: await this.projectLifecycleState(args.projectId, args.manifest),
      mutations: await this.resolveLayoutMutations(args.projectId),
      regenerateRouterFiles: true,
    });
  }

  async rebuildRootLayout(projectId: string) {
    await this.ensureProjectExists(projectId);
    return await this.projectManager.rebuildRootLayout({
      projectId,
      mutations: await this.resolveLayoutMutations(projectId),
    });
  }

  private createModuleAdminRuntimeContext(
    projectId: string,
    moduleId: string,
    appPath: string,
    componentMeta: unknown,
  ): HostModuleAdminRuntimeContext {
    return {
      projectRoot: appPath,
      readConfig: async () => {
        const state = await this.getModuleOrchestrator(appPath).getModule(moduleId);
        if (!state?.installed) throw new Error(`Module '${moduleId}' is not installed.`);
        return state.installation.config;
      },
      reconfigureConfig: async (config) => {
        await this.updateModuleConfig(projectId, moduleId, config);
      },
      readAuthoringContext: async () => {
        const manifest = await this.projectManager.getStudioManifest(projectId);
        return {
          screens: Object.values(manifest.screens).map((screen) => ({
            id: screen.id,
            root: screen.root,
          })),
          componentMeta: componentMeta ?? {},
        };
      },
      mutateManifestField: async (mutation) => {
        await this.mutateModuleAdminManifestField(projectId, mutation);
      },
    };
  }

  private async mutateModuleAdminManifestField(
    projectId: string,
    mutation: HostModuleManifestFieldMutation,
  ): Promise<void> {
    const screenId = mutation.screenId.trim();
    const nodeId = mutation.nodeId.trim();
    const prop = mutation.prop.trim();
    if (!screenId || !nodeId || !prop) {
      throw new Error('Module admin manifest mutation requires screenId, nodeId, and prop.');
    }

    const manifest = await this.projectManager.getStudioManifest(projectId);
    const screen = manifest.screens[screenId];
    if (!screen || screen.id !== screenId) {
      throw new Error(`Screen '${screenId}' is not available for module administration.`);
    }
    if (!findNodeInManifest(screen.root, nodeId)) {
      throw new Error(`Node '${nodeId}' is not available on screen '${screenId}'.`);
    }

    const nextManifest = updateStudioManifestNode(manifest, screenId, nodeId, {
      [prop]: mutation.value,
    });
    await this.saveStudioManifest({ projectId, manifest: nextManifest });
  }

  private async prepareProjectForLifecycle(projectId: string) {
    await this.ensureProjectExists(projectId);
    await this.projectManager.syncProject({
      projectId,
      mutations: await this.resolveLayoutMutations(projectId),
    });
    await this.applyPendingOperations(projectId);
  }

  private async persistLifecycleProjection(projectId: string) {
    const manifest = await this.projectManager.getProjectManifest(projectId);
    const nextManifest = await this.projectLifecycleState(projectId, manifest);

    await this.projectManager.saveProjectManifest({
      projectId,
      manifest: nextManifest,
      mutations: await this.resolveLayoutMutations(projectId),
      regenerateRouterFiles: true,
    });
    return nextManifest;
  }

  private async projectLifecycleState(
    projectId: string,
    manifest: AppManifest,
  ): Promise<AppManifest> {
    const states = await this.getModuleOrchestrator(this.getAppPath(projectId)).listModules();
    const installed = states.filter((state) => state.installed);
    const modules = installed
      .map((state) => state.moduleId)
      .sort((left, right) => left.localeCompare(right));
    const modulesConfig = Object.fromEntries(
      installed.map((state) => [state.moduleId, state.installation.config]),
    );

    return {
      ...manifest,
      infra: {
        ...manifest.infra,
        modules,
        modulesConfig,
      },
    };
  }

  private async resolveLayoutMutations(projectId: string) {
    const appPath = this.getAppPath(projectId);
    const [states, pending] = await Promise.all([
      this.getModuleOrchestrator(appPath).listModules(),
      this.readPending(appPath),
    ]);
    const pendingIds = new Set(pending.ops.map((operation) => operation.moduleId));
    return resolveModuleLayoutMutations(
      states
        .filter((state) => state.installed && !pendingIds.has(state.moduleId))
        .map((state) => state.moduleId),
    );
  }

  private requireHostModule(moduleId: string): HostModuleContribution {
    const contribution = getHostModule(moduleId);
    if (!contribution) {
      throw new Error(`Module '${moduleId}' is not available in the host registry.`);
    }
    return contribution;
  }

  private getModuleOrchestrator(appPath: string): Orchestrator {
    const cached = this.orchestratorsByAppRoot.get(appPath);
    if (cached) return cached;

    const orchestrator = createOrchestrator({
      modules: listHostModules().map((module) => module.definition),
      projectRoot: appPath,
    });
    this.orchestratorsByAppRoot.set(appPath, orchestrator);
    return orchestrator;
  }

  private toHostModuleState(
    state: ModuleState,
    contribution: HostModuleContribution | null,
    pendingRemoval: boolean,
  ): HostModuleState {
    const admin = resolveHostModuleAdminContribution(contribution);
    return {
      id: state.moduleId,
      name: contribution?.name ?? state.moduleId,
      description:
        contribution?.description ??
        'Installed module is unavailable in the current host registry.',
      available: state.available,
      installed: state.installed,
      pendingRemoval,
      ...(state.available && state.registration.version
        ? { registrationVersion: state.registration.version }
        : {}),
      ...(state.installed && state.installation.version
        ? { installedVersion: state.installation.version }
        : {}),
      ...(state.installed ? { installedAt: state.installation.installedAt } : {}),
      dependencies: state.available
        ? state.registration.dependencies
        : state.installation.dependencies,
      dependents: state.installed ? state.installation.dependents : [],
      config: state.installed ? state.installation.config : null,
      admin: admin.admin,
      ...(admin.error ? { adminError: admin.error } : {}),
    };
  }

  private normalizeConfig(
    contribution: HostModuleContribution,
    config: unknown,
  ): Record<string, unknown> {
    if (!isRecord(config)) {
      throw new Error(`Invalid config for module '${contribution.id}': expected an object.`);
    }
    const normalized = contribution.normalizeConfig(config);
    if (!isRecord(normalized)) {
      throw new Error(`Invalid normalized config for module '${contribution.id}'.`);
    }
    try {
      JSON.stringify(normalized);
    } catch {
      throw new Error(`Invalid config for module '${contribution.id}': must be JSON serializable.`);
    }
    return normalized;
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

  private async readPending(appPath: string): Promise<PendingOpsData> {
    const fullPath = path.join(appPath, PENDING_OPS_FILE);
    if (!(await this.adapter.exists(fullPath))) return { ops: [] };
    return (await this.adapter.readJson<PendingOpsData>(fullPath)) ?? { ops: [] };
  }

  private async writePending(appPath: string, data: PendingOpsData) {
    const fullPath = path.join(appPath, PENDING_OPS_FILE);
    await this.adapter.ensureDir(path.dirname(fullPath));
    await this.adapter.writeJson(fullPath, data);
  }

  private async enqueuePending(appPath: string, operation: PendingOperation) {
    const data = await this.readPending(appPath);
    if (data.ops.some((pending) => pending.moduleId === operation.moduleId)) return;
    await this.writePending(appPath, { ops: [...data.ops, operation] });
  }

  private async removePendingOperation(appPath: string, moduleId: string) {
    const data = await this.readPending(appPath);
    const ops = data.ops.filter((operation) => operation.moduleId !== moduleId);
    if (ops.length === data.ops.length) return;
    if (ops.length === 0) {
      await this.clearPending(appPath);
      return;
    }
    await this.writePending(appPath, { ops });
  }

  private async clearPending(appPath: string) {
    const fullPath = path.join(appPath, PENDING_OPS_FILE);
    if (await this.adapter.exists(fullPath)) await this.adapter.remove(fullPath);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
