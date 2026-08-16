import type { AppDeployManifest } from '@ankhorage/contracts/deploy';
import type {
  MonetizationDesiredState,
  MonetizationProduct,
  ReleaseControlExecutionResult,
  ReleaseDesiredState,
  ReleaseLifecycleControl,
  ReleasePlan,
} from '@ankhorage/deploy';
import type {
  ProjectMonetizationExecutionResult,
  ProjectMonetizationInspection,
  ProjectMonetizationPlan,
  ProjectReleaseHistoryRecord,
  ProjectReleaseInput,
  ProjectReleaseInspection,
  ProjectStoreListing,
  ProjectStoreListingAssetLocation,
  StoreListingLocale,
} from '@ankhorage/deploy/project';

import { createProjectDeployRequest } from './createProjectDeployRequest';
import { ProjectDeployClient } from './projectDeployClient';
import type { ProjectDeployMonetizationInspectionResult } from './projectDeployMonetizationInspectionResult';
import type { ProjectDeployReleaseExecutionResponse } from './projectDeployReleaseExecutionResponse';
import type { ProjectDeployReleaseHistoryRecord } from './projectDeployReleaseHistoryRecord';
import type { ProjectDeployReleaseInspectionResult } from './projectDeployReleaseInspectionResult';
import type { ProjectDeployRuntimeInput } from './projectDeployRuntimeInput';

const client = new ProjectDeployClient(createProjectDeployRequest());

export function readProjectDeployConfig(projectId: string): Promise<AppDeployManifest | null> {
  return client.readConfig(projectId);
}

export function readProjectDeployListing(projectId: string): Promise<ProjectStoreListing> {
  return client.readListing(projectId);
}

export function writeProjectDeployListingLocale(
  projectId: string,
  locale: StoreListingLocale,
): Promise<ProjectStoreListing> {
  return client.writeListingLocale(projectId, locale);
}

export function removeProjectDeployListingLocale(
  projectId: string,
  locale: string,
): Promise<ProjectStoreListing> {
  return client.removeListingLocale(projectId, locale);
}

export function writeProjectDeployListingAsset(
  projectId: string,
  location: ProjectStoreListingAssetLocation,
  data: Uint8Array,
): Promise<ProjectStoreListing> {
  return client.writeListingAsset(projectId, location, data);
}

export function removeProjectDeployListingAsset(
  projectId: string,
  location: ProjectStoreListingAssetLocation,
): Promise<ProjectStoreListing> {
  return client.removeListingAsset(projectId, location);
}

export function readProjectDeployMonetization(
  projectId: string,
): Promise<MonetizationDesiredState> {
  return client.readMonetization(projectId);
}

export function writeProjectDeployMonetization(
  projectId: string,
  products: readonly MonetizationProduct[],
): Promise<MonetizationDesiredState> {
  return client.writeMonetization(projectId, products);
}

export function inspectProjectDeployMonetization(input: {
  readonly projectId: string;
  readonly runtime: ProjectDeployRuntimeInput;
}): Promise<ProjectDeployMonetizationInspectionResult> {
  return client.inspectMonetization(input);
}

export function executeProjectDeployMonetization(input: {
  readonly projectId: string;
  readonly runtime: ProjectDeployRuntimeInput;
  readonly inspection: ProjectMonetizationInspection;
  readonly plan: ProjectMonetizationPlan;
}): Promise<ProjectMonetizationExecutionResult> {
  return client.executeMonetization(input);
}

export function readProjectDeployRelease(projectId: string): Promise<ReleaseDesiredState> {
  return client.readRelease(projectId);
}

export function writeProjectDeployRelease(
  projectId: string,
  release: ProjectReleaseInput,
): Promise<ReleaseDesiredState> {
  return client.writeRelease(projectId, release);
}

export async function listProjectDeployReleaseHistory(
  projectId: string,
): Promise<readonly ProjectDeployReleaseHistoryRecord[]> {
  const records = await client.listReleaseHistory(projectId);
  if (!records.every(hasResumableProjection)) {
    throw new Error('The Studio host returned release history without resumability state.');
  }
  return records;
}

export async function inspectProjectDeployRelease(input: {
  readonly projectId: string;
  readonly runtime: ProjectDeployRuntimeInput;
}): Promise<ProjectDeployReleaseInspectionResult> {
  const result = await client.inspectRelease(input);
  if (result.ok && !Array.isArray(result.lifecycleControls)) {
    throw new Error('The Studio host returned release inspection without lifecycle controls.');
  }
  return result;
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

function hasResumableProjection(
  record: ProjectReleaseHistoryRecord,
): record is ProjectDeployReleaseHistoryRecord {
  const projected = record as ProjectReleaseHistoryRecord & { readonly resumable?: unknown };
  return typeof projected.resumable === 'boolean';
}
