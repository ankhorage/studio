import type { AppDeployManifest } from '@ankhorage/contracts/deploy';
import type {
  MonetizationDesiredState,
  ReleaseControlExecutionResult,
  ReleaseDesiredState,
  ReleaseLifecycleControl,
  ReleasePlan,
} from '@ankhorage/deploy';
import type {
  ProjectReleaseHistoryRecord,
  ProjectReleaseInspection,
  ProjectStoreListing,
} from '@ankhorage/deploy/project';

import { createProjectDeployRequest } from './createProjectDeployRequest';
import { ProjectDeployClient } from './projectDeployClient';
import type { ProjectDeployReleaseExecutionResponse } from './projectDeployReleaseExecutionResponse';
import type { ProjectDeployReleaseInspectionResult } from './projectDeployReleaseInspectionResult';
import type { ProjectDeployRuntimeInput } from './projectDeployRuntimeInput';

const client = new ProjectDeployClient(createProjectDeployRequest());

export function readProjectDeployConfig(projectId: string): Promise<AppDeployManifest | null> {
  return client.readConfig(projectId);
}

export function readProjectDeployListing(projectId: string): Promise<ProjectStoreListing> {
  return client.readListing(projectId);
}

export function readProjectDeployMonetization(
  projectId: string,
): Promise<MonetizationDesiredState> {
  return client.readMonetization(projectId);
}

export function readProjectDeployRelease(projectId: string): Promise<ReleaseDesiredState> {
  return client.readRelease(projectId);
}

export function listProjectDeployReleaseHistory(
  projectId: string,
): Promise<readonly ProjectReleaseHistoryRecord[]> {
  return client.listReleaseHistory(projectId);
}

export function inspectProjectDeployRelease(input: {
  readonly projectId: string;
  readonly runtime: ProjectDeployRuntimeInput;
}): Promise<ProjectDeployReleaseInspectionResult> {
  return client.inspectRelease(input);
}

export function executeProjectDeployRelease(input: {
  readonly projectId: string;
  readonly runtime: ProjectDeployRuntimeInput;
  readonly inspection: ProjectReleaseInspection;
  readonly plan: ReleasePlan;
}): Promise<ProjectDeployReleaseExecutionResponse> {
  return client.executeRelease(input);
}

export function resumeProjectDeployRelease(input: {
  readonly projectId: string;
  readonly runtime: ProjectDeployRuntimeInput;
  readonly previousExecutionId: string;
}): Promise<ProjectDeployReleaseExecutionResponse> {
  return client.resumeRelease(input);
}

export function executeProjectDeployReleaseControl(input: {
  readonly projectId: string;
  readonly runtime: ProjectDeployRuntimeInput;
  readonly control: ReleaseLifecycleControl;
}): Promise<ReleaseControlExecutionResult> {
  return client.executeReleaseControl(input);
}
