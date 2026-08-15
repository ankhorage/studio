import type { AppDeployManifest } from '@ankhorage/contracts/deploy';
import type { MonetizationDesiredState, ReleaseDesiredState } from '@ankhorage/deploy';
import type { ProjectReleaseHistoryRecord, ProjectStoreListing } from '@ankhorage/deploy/project';

import { createProjectDeployRequest } from './createProjectDeployRequest';
import { ProjectDeployClient } from './projectDeployClient';
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
