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

/*** Read authored deploy configuration through the shared deploy client. @todo Move the deploy facade under src/deploy/. */
export function readProjectDeployConfig(projectId: string): Promise<AppDeployManifest | null> {
  return client.readConfig(projectId);
}

/*** Read the project store listing through the shared deploy client. @todo Move the deploy facade under src/deploy/. */
export function readProjectDeployListing(projectId: string): Promise<ProjectStoreListing> {
  return client.readListing(projectId);
}

/*** Write one store-listing locale through the shared deploy client. @todo Move the deploy facade under src/deploy/. */
export function writeProjectDeployListingLocale(
  projectId: string,
  locale: StoreListingLocale,
): Promise<ProjectStoreListing> {
  return client.writeListingLocale(projectId, locale);
}

/*** Remove one store-listing locale through the shared deploy client. @todo Move the deploy facade under src/deploy/. */
export function removeProjectDeployListingLocale(
  projectId: string,
  locale: string,
): Promise<ProjectStoreListing> {
  return client.removeListingLocale(projectId, locale);
}

/*** Upload one store-listing asset through the shared deploy client. @todo Move the deploy facade under src/deploy/. */
export function writeProjectDeployListingAsset(
  projectId: string,
  location: ProjectStoreListingAssetLocation,
  data: Uint8Array,
): Promise<ProjectStoreListing> {
  return client.writeListingAsset(projectId, location, data);
}

/*** Remove one store-listing asset through the shared deploy client. @todo Move the deploy facade under src/deploy/. */
export function removeProjectDeployListingAsset(
  projectId: string,
  location: ProjectStoreListingAssetLocation,
): Promise<ProjectStoreListing> {
  return client.removeListingAsset(projectId, location);
}

/*** Read authored monetization state through the shared deploy client. @todo Move the deploy facade under src/deploy/. */
export function readProjectDeployMonetization(
  projectId: string,
): Promise<MonetizationDesiredState> {
  return client.readMonetization(projectId);
}

/*** Write authored monetization products through the shared deploy client. @todo Move the deploy facade under src/deploy/. */
export function writeProjectDeployMonetization(
  projectId: string,
  products: readonly MonetizationProduct[],
): Promise<MonetizationDesiredState> {
  return client.writeMonetization(projectId, products);
}

/*** Inspect monetization changes for one project/runtime target. @todo Move deploy inspection under src/deploy/. */
export function inspectProjectDeployMonetization(input: {
  readonly projectId: string;
  readonly runtime: ProjectDeployRuntimeInput;
}): Promise<ProjectDeployMonetizationInspectionResult> {
  return client.inspectMonetization(input);
}

/*** Execute an inspected monetization plan. @todo Move deploy execution under src/deploy/. */
export function executeProjectDeployMonetization(input: {
  readonly projectId: string;
  readonly runtime: ProjectDeployRuntimeInput;
  readonly inspection: ProjectMonetizationInspection;
  readonly plan: ProjectMonetizationPlan;
}): Promise<ProjectMonetizationExecutionResult> {
  return client.executeMonetization(input);
}

/*** Read authored release state through the shared deploy client. @todo Move the deploy facade under src/deploy/. */
export function readProjectDeployRelease(projectId: string): Promise<ReleaseDesiredState> {
  return client.readRelease(projectId);
}

/*** Write authored release state through the shared deploy client. @todo Move the deploy facade under src/deploy/. */
export function writeProjectDeployRelease(
  projectId: string,
  release: ProjectReleaseInput,
): Promise<ReleaseDesiredState> {
  return client.writeRelease(projectId, release);
}

/*** Read release history and require the Studio resumability projection on every record. @todo Move deploy history access under src/deploy/. */
export async function listProjectDeployReleaseHistory(
  projectId: string,
): Promise<readonly ProjectDeployReleaseHistoryRecord[]> {
  const records = await client.listReleaseHistory(projectId);
  if (!records.every(hasResumableProjection)) {
    throw new Error('The Studio host returned release history without resumability state.');
  }
  return records;
}

/*** Inspect a project release and require lifecycle controls in successful results. @todo Move deploy inspection under src/deploy/. */
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

/*** Execute an inspected project release plan. @todo Move deploy execution under src/deploy/. */
export function executeProjectDeployRelease(input: {
  readonly projectId: string;
  readonly runtime: ProjectDeployRuntimeInput;
  readonly inspection: ProjectReleaseInspection;
  readonly plan: ReleasePlan;
}): Promise<ProjectDeployReleaseExecutionResponse> {
  return client.executeRelease(input);
}

/*** Resume a previous project release execution. @todo Move deploy execution under src/deploy/. */
export function resumeProjectDeployRelease(input: {
  readonly projectId: string;
  readonly runtime: ProjectDeployRuntimeInput;
  readonly previousExecutionId: string;
}): Promise<ProjectDeployReleaseExecutionResponse> {
  return client.resumeRelease(input);
}

/*** Execute one release lifecycle control action. @todo Move deploy lifecycle control under src/deploy/. */
export function executeProjectDeployReleaseControl(input: {
  readonly projectId: string;
  readonly runtime: ProjectDeployRuntimeInput;
  readonly control: ReleaseLifecycleControl;
}): Promise<ReleaseControlExecutionResult> {
  return client.executeReleaseControl(input);
}

/***
 * Narrow a release-history record to the Studio projection that includes resumability state.
 * @todo Keep this deploy response contract guard under src/deploy/ or move it to the owning deploy contract package.
 */
function hasResumableProjection(
  record: ProjectReleaseHistoryRecord,
): record is ProjectDeployReleaseHistoryRecord {
  const projected = record as ProjectReleaseHistoryRecord & { readonly resumable?: unknown };
  return typeof projected.resumable === 'boolean';
}
