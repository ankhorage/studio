import type { AppDeployManifest } from '@ankhorage/contracts/deploy';
import type { MonetizationProduct, ReleaseLifecycleControl, ReleasePlan } from '@ankhorage/deploy';
import type {
  ProjectReleaseExecutionResult,
  ProjectReleaseInput,
  ProjectReleaseInspection,
  ProjectStoreListingAssetLocation,
  StoreListingLocale,
} from '@ankhorage/deploy/project';
import {
  createProjectReleasePlan,
  executeProjectRelease,
  executeProjectReleaseControl,
  inspectProjectRelease,
  listProjectReleaseHistory,
  readProjectDeploymentConfig,
  readProjectMonetization,
  readProjectRelease,
  readProjectStoreListing,
  removeProjectStoreListingAsset,
  removeProjectStoreListingLocale,
  resumeProjectRelease,
  updateProjectDeploymentConfig,
  writeProjectMonetization,
  writeProjectRelease,
  writeProjectStoreListingAsset,
  writeProjectStoreListingLocale,
} from '@ankhorage/deploy/project';

import type { ProjectDeployReleaseInspectionResult } from '../../projectDeployReleaseInspectionResult';
import type { ProjectManager } from '../orchestrator/projectManager';
import { getProjectPath } from '../orchestrator/projectPaths';
import { ProjectSecretService } from '../secrets/projectSecretService';
import { createProjectDeployAccess } from './createProjectDeployAccess';
import { ProjectDeployMutationGuard } from './ProjectDeployMutationGuard';
import type { ProjectDeployRuntimeInput } from './ProjectDeployRuntimeInput';
import type { ProjectDeploySecretStore } from './ProjectDeploySecretStore';

export interface ProjectDeployServiceOptions {
  readonly projectManager: ProjectManager;
  readonly workspaceRoot: string;
  readonly secretStore?: ProjectDeploySecretStore;
}

export type { ProjectDeployReleaseInspectionResult } from '../../projectDeployReleaseInspectionResult';

export class ProjectDeployService {
  private readonly workspaceRoot: string;
  private readonly secretStore: ProjectDeploySecretStore;
  private readonly releaseMutationGuard = new ProjectDeployMutationGuard();

  constructor(options: ProjectDeployServiceOptions) {
    this.workspaceRoot = options.workspaceRoot;
    this.secretStore =
      options.secretStore ??
      new ProjectSecretService({
        projectManager: options.projectManager,
        workspaceRoot: options.workspaceRoot,
      });
  }

  readConfig(projectId: string): Promise<AppDeployManifest | null> {
    return readProjectDeploymentConfig({ projectRoot: this.projectRoot(projectId) });
  }

  updateConfig(
    projectId: string,
    config: AppDeployManifest | null,
  ): Promise<AppDeployManifest | null> {
    return updateProjectDeploymentConfig({
      projectRoot: this.projectRoot(projectId),
      update: () => config,
    });
  }

  readListing(projectId: string) {
    return readProjectStoreListing({ projectRoot: this.projectRoot(projectId) });
  }

  writeListingLocale(projectId: string, locale: StoreListingLocale) {
    return writeProjectStoreListingLocale({
      projectRoot: this.projectRoot(projectId),
      locale,
    });
  }

  removeListingLocale(projectId: string, locale: string) {
    return removeProjectStoreListingLocale({
      projectRoot: this.projectRoot(projectId),
      locale,
    });
  }

  writeListingAsset(
    projectId: string,
    location: ProjectStoreListingAssetLocation,
    data: Uint8Array,
  ) {
    return writeProjectStoreListingAsset({
      projectRoot: this.projectRoot(projectId),
      location,
      data,
    });
  }

  removeListingAsset(projectId: string, location: ProjectStoreListingAssetLocation) {
    return removeProjectStoreListingAsset({
      projectRoot: this.projectRoot(projectId),
      location,
    });
  }

  readMonetization(projectId: string) {
    return readProjectMonetization({ projectRoot: this.projectRoot(projectId) });
  }

  writeMonetization(projectId: string, products: readonly MonetizationProduct[]) {
    return writeProjectMonetization({
      projectRoot: this.projectRoot(projectId),
      products,
    });
  }

  readRelease(projectId: string) {
    return readProjectRelease({ projectRoot: this.projectRoot(projectId) });
  }

  writeRelease(projectId: string, release: ProjectReleaseInput) {
    return writeProjectRelease({
      projectRoot: this.projectRoot(projectId),
      release,
    });
  }

  async inspectRelease(
    projectId: string,
    runtime: ProjectDeployRuntimeInput,
  ): Promise<ProjectDeployReleaseInspectionResult> {
    const access = await this.createAccess(projectId, runtime);
    const result = await inspectProjectRelease({
      projectRoot: this.projectRoot(projectId),
      ...access,
    });
    if (!result.ok) return result;
    return {
      ok: true,
      inspection: result.inspection,
      plan: createProjectReleasePlan(result.inspection),
    };
  }

  executeRelease(input: {
    readonly projectId: string;
    readonly runtime: ProjectDeployRuntimeInput;
    readonly inspection: ProjectReleaseInspection;
    readonly plan: ReleasePlan;
    readonly executionId: string;
  }): Promise<ProjectReleaseExecutionResult> {
    return this.releaseMutationGuard.run(input.projectId, async () => {
      const access = await this.createAccess(input.projectId, input.runtime);
      return executeProjectRelease({
        inspection: input.inspection,
        plan: input.plan,
        executionId: input.executionId,
        ...access,
      });
    });
  }

  resumeRelease(input: {
    readonly projectId: string;
    readonly runtime: ProjectDeployRuntimeInput;
    readonly previousExecutionId: string;
    readonly executionId: string;
  }): Promise<ProjectReleaseExecutionResult> {
    return this.releaseMutationGuard.run(input.projectId, async () => {
      const access = await this.createAccess(input.projectId, input.runtime);
      return resumeProjectRelease({
        projectRoot: this.projectRoot(input.projectId),
        previousExecutionId: input.previousExecutionId,
        executionId: input.executionId,
        ...access,
      });
    });
  }

  executeReleaseControl(input: {
    readonly projectId: string;
    readonly runtime: ProjectDeployRuntimeInput;
    readonly control: ReleaseLifecycleControl;
  }) {
    return this.releaseMutationGuard.run(input.projectId, async () => {
      const access = await this.createAccess(input.projectId, input.runtime);
      return executeProjectReleaseControl({
        projectRoot: this.projectRoot(input.projectId),
        control: input.control,
        ...access,
      });
    });
  }

  listReleaseHistory(projectId: string) {
    return listProjectReleaseHistory({ projectRoot: this.projectRoot(projectId) });
  }

  private projectRoot(projectId: string): string {
    return getProjectPath(this.workspaceRoot, projectId);
  }

  private createAccess(projectId: string, runtime: ProjectDeployRuntimeInput) {
    return createProjectDeployAccess({
      projectId,
      runtime,
      secretStore: this.secretStore,
    });
  }
}
