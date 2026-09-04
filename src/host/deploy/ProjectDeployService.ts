import type { AppDeployManifest } from '@ankhorage/contracts/deploy';
import {
  isReleaseStepResumable,
  listReleaseLifecycleControls,
  type MonetizationProduct,
  type ReleaseLifecycleControl,
  type ReleasePlan,
} from '@ankhorage/deploy';
import type {
  ProjectMonetizationExecutionResult,
  ProjectMonetizationInspection,
  ProjectMonetizationPlan,
  ProjectReleaseExecutionResult,
  ProjectReleaseInput,
  ProjectReleaseInspection,
  ProjectStoreListingAssetLocation,
  StoreListingLocale,
} from '@ankhorage/deploy/project';
import {
  createProjectMonetizationPlan,
  createProjectReleasePlan,
  executeProjectMonetizationSync,
  executeProjectRelease,
  executeProjectReleaseControl,
  inspectProjectMonetization,
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

import type { ProjectDeployMonetizationInspectionResult } from '../../projectDeployMonetizationInspectionResult';
import type { ProjectDeployReleaseHistoryRecord } from '../../projectDeployReleaseHistoryRecord';
import type { ProjectDeployReleaseInspectionResult } from '../../projectDeployReleaseInspectionResult';
import type { ProjectDeployRuntimeInput } from '../../projectDeployRuntimeInput';
import type { ProjectManager } from '../orchestrator/projectManager';
import { getProjectPath } from '../orchestrator/projectPaths';
import { ProjectSecretService } from '../secrets/projectSecretService';
import { createProjectDeployAccess } from './createProjectDeployAccess';
import { ProjectDeployMutationGuard } from './ProjectDeployMutationGuard';
import type { ProjectDeploySecretStore } from './ProjectDeploySecretStore';

export interface ProjectDeployServiceOptions {
  readonly projectManager: ProjectManager;
  readonly workspaceRoot: string;
  readonly secretStore?: ProjectDeploySecretStore;
}

/*** Adapt Studio project paths, secrets, and runtime credentials to the package-owned Deploy project APIs. */
export class ProjectDeployService {
  private readonly workspaceRoot: string;
  private readonly secretStore: ProjectDeploySecretStore;
  private readonly mutationGuard = new ProjectDeployMutationGuard();

  /*** Construct the host Deploy adapter with an injected or default project secret store. */
  constructor(options: ProjectDeployServiceOptions) {
    this.workspaceRoot = options.workspaceRoot;
    this.secretStore =
      options.secretStore ??
      new ProjectSecretService({
        projectManager: options.projectManager,
        workspaceRoot: options.workspaceRoot,
      });
  }

  /*** Read the persisted Deploy manifest for one generated project. */
  readConfig(projectId: string): Promise<AppDeployManifest | null> {
    return readProjectDeploymentConfig({ projectRoot: this.projectRoot(projectId) });
  }

  /*** Replace the persisted Deploy manifest for one generated project. */
  updateConfig(
    projectId: string,
    config: AppDeployManifest | null,
  ): Promise<AppDeployManifest | null> {
    return updateProjectDeploymentConfig({
      projectRoot: this.projectRoot(projectId),
      update: () => config,
    });
  }

  /*** Read authored store-listing state for one generated project. */
  readListing(projectId: string) {
    return readProjectStoreListing({ projectRoot: this.projectRoot(projectId) });
  }

  /*** Persist one localized store-listing record for a project. */
  writeListingLocale(projectId: string, locale: StoreListingLocale) {
    return writeProjectStoreListingLocale({
      projectRoot: this.projectRoot(projectId),
      locale,
    });
  }

  /*** Remove one localized store-listing record from a project. */
  removeListingLocale(projectId: string, locale: string) {
    return removeProjectStoreListingLocale({
      projectRoot: this.projectRoot(projectId),
      locale,
    });
  }

  /*** Persist one binary store-listing asset at its Deploy-owned location. */
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

  /*** Remove one authored store-listing asset from a project. */
  removeListingAsset(projectId: string, location: ProjectStoreListingAssetLocation) {
    return removeProjectStoreListingAsset({
      projectRoot: this.projectRoot(projectId),
      location,
    });
  }

  /*** Read authored monetization products for one project. */
  readMonetization(projectId: string) {
    return readProjectMonetization({ projectRoot: this.projectRoot(projectId) });
  }

  /*** Persist authored monetization products for one project. */
  writeMonetization(projectId: string, products: readonly MonetizationProduct[]) {
    return writeProjectMonetization({
      projectRoot: this.projectRoot(projectId),
      products,
    });
  }

  /*** Inspect monetization state and pair the package-owned inspection with its derived execution plan. */
  async inspectMonetization(
    projectId: string,
    runtime: ProjectDeployRuntimeInput,
  ): Promise<ProjectDeployMonetizationInspectionResult> {
    const access = await this.createAccess(projectId, runtime);
    const result = await inspectProjectMonetization({
      projectRoot: this.projectRoot(projectId),
      ...access,
    });
    if (!result.ok) return result;
    return {
      ok: true,
      inspection: result.inspection,
      plan: createProjectMonetizationPlan(result.inspection),
    };
  }

  /*** Execute a monetization synchronization under the project's exclusive mutation reservation. */
  executeMonetization(input: {
    readonly projectId: string;
    readonly runtime: ProjectDeployRuntimeInput;
    readonly inspection: ProjectMonetizationInspection;
    readonly plan: ProjectMonetizationPlan;
  }): Promise<ProjectMonetizationExecutionResult> {
    return this.mutationGuard.run(input.projectId, async () => {
      const access = await this.createAccess(input.projectId, input.runtime);
      return executeProjectMonetizationSync({
        inspection: input.inspection,
        plan: input.plan,
        ...access,
      });
    });
  }

  /*** Read the authored release definition for one project. */
  readRelease(projectId: string) {
    return readProjectRelease({ projectRoot: this.projectRoot(projectId) });
  }

  /*** Persist the authored release definition for one project. */
  writeRelease(projectId: string, release: ProjectReleaseInput) {
    return writeProjectRelease({
      projectRoot: this.projectRoot(projectId),
      release,
    });
  }

  /*** Inspect release readiness and augment the package-owned inspection with its plan and lifecycle controls. */
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
      lifecycleControls: result.inspection.observed.targets.flatMap(listReleaseLifecycleControls),
    };
  }

  /*** Execute a release plan under the project's exclusive mutation reservation. */
  executeRelease(input: {
    readonly projectId: string;
    readonly runtime: ProjectDeployRuntimeInput;
    readonly inspection: ProjectReleaseInspection;
    readonly plan: ReleasePlan;
    readonly executionId: string;
  }): Promise<ProjectReleaseExecutionResult> {
    return this.mutationGuard.run(input.projectId, async () => {
      const access = await this.createAccess(input.projectId, input.runtime);
      return executeProjectRelease({
        inspection: input.inspection,
        plan: input.plan,
        executionId: input.executionId,
        ...access,
      });
    });
  }

  /*** Resume a prior release execution under the project's exclusive mutation reservation. */
  resumeRelease(input: {
    readonly projectId: string;
    readonly runtime: ProjectDeployRuntimeInput;
    readonly previousExecutionId: string;
    readonly executionId: string;
  }): Promise<ProjectReleaseExecutionResult> {
    return this.mutationGuard.run(input.projectId, async () => {
      const access = await this.createAccess(input.projectId, input.runtime);
      return resumeProjectRelease({
        projectRoot: this.projectRoot(input.projectId),
        previousExecutionId: input.previousExecutionId,
        executionId: input.executionId,
        ...access,
      });
    });
  }

  /*** Execute one release lifecycle control under the project's exclusive mutation reservation. */
  executeReleaseControl(input: {
    readonly projectId: string;
    readonly runtime: ProjectDeployRuntimeInput;
    readonly control: ReleaseLifecycleControl;
  }) {
    return this.mutationGuard.run(input.projectId, async () => {
      const access = await this.createAccess(input.projectId, input.runtime);
      return executeProjectReleaseControl({
        projectRoot: this.projectRoot(input.projectId),
        control: input.control,
        ...access,
      });
    });
  }

  /*** List prior release executions and project each record with its resumability state. */
  async listReleaseHistory(
    projectId: string,
  ): Promise<readonly ProjectDeployReleaseHistoryRecord[]> {
    const records = await listProjectReleaseHistory({ projectRoot: this.projectRoot(projectId) });
    return records.map((record) => ({
      ...record,
      resumable: record.execution.steps.some(isReleaseStepResumable),
    }));
  }

  /*** Resolve one Studio project id to its generated project root. */
  private projectRoot(projectId: string): string {
    return getProjectPath(this.workspaceRoot, projectId);
  }

  /*** Build package-owned Deploy access from the project's runtime input and secret store. */
  private createAccess(projectId: string, runtime: ProjectDeployRuntimeInput) {
    return createProjectDeployAccess({
      projectId,
      runtime,
      secretStore: this.secretStore,
    });
  }
}
