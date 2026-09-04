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
import { toStandaloneArrayBuffer } from '@ankhorage/utility/binary';

import { ProjectDeployApiError } from './projectDeployApiError';
import type { ProjectDeployMonetizationInspectionResult } from './projectDeployMonetizationInspectionResult';
import type { ProjectDeployReleaseExecutionResponse } from './projectDeployReleaseExecutionResponse';
import type { ProjectDeployReleaseInspectionResult } from './projectDeployReleaseInspectionResult';
import type { ProjectDeployRequest } from './projectDeployRequest';
import type { ProjectDeployRuntimeInput } from './projectDeployRuntimeInput';
import { findRawSecretResponseKey } from './secretResponseGuard';

/*** Execute and validate Studio deploy HTTP operations through an injected request transport. @todo Move this concrete deploy client under src/deploy/ at the package edge. */
export class ProjectDeployClient {
  /*** Create a deploy client around an injected request transport. */
  constructor(private readonly request: ProjectDeployRequest) {}

  /*** Read and parse authored deploy configuration for one project. */
  readConfig(projectId: string): Promise<AppDeployManifest | null> {
    return this.requestJson(projectPath(projectId, 'config'), undefined, parseConfig);
  }

  /*** Read and parse the project store listing. */
  readListing(projectId: string): Promise<ProjectStoreListing> {
    return this.requestJson(projectPath(projectId, 'listing'), undefined, parseListing);
  }

  /*** Write one store-listing locale and parse the resulting listing. */
  writeListingLocale(projectId: string, locale: StoreListingLocale): Promise<ProjectStoreListing> {
    return this.requestJson(
      projectPath(projectId, 'listing/locale'),
      jsonRequest('PUT', locale),
      parseListing,
    );
  }

  /*** Delete one store-listing locale and parse the resulting listing. */
  removeListingLocale(projectId: string, locale: string): Promise<ProjectStoreListing> {
    return this.requestJson(
      `${projectPath(projectId, 'listing/locale')}/${encodeURIComponent(locale)}`,
      { method: 'DELETE' },
      parseListing,
    );
  }

  /*** Upload one binary listing asset to its deploy location and parse the resulting listing. */
  writeListingAsset(
    projectId: string,
    location: ProjectStoreListingAssetLocation,
    data: Uint8Array,
  ): Promise<ProjectStoreListing> {
    return this.requestJson(
      withAssetLocation(projectPath(projectId, 'listing/asset'), location),
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: toStandaloneArrayBuffer(data),
      },
      parseListing,
    );
  }

  /*** Delete one listing asset from its deploy location and parse the resulting listing. */
  removeListingAsset(
    projectId: string,
    location: ProjectStoreListingAssetLocation,
  ): Promise<ProjectStoreListing> {
    return this.requestJson(
      withAssetLocation(projectPath(projectId, 'listing/asset'), location),
      { method: 'DELETE' },
      parseListing,
    );
  }

  /*** Read and parse authored project monetization state. */
  readMonetization(projectId: string): Promise<MonetizationDesiredState> {
    return this.requestJson(projectPath(projectId, 'monetization'), undefined, parseMonetization);
  }

  /*** Write monetization products and parse the resulting desired state. */
  writeMonetization(
    projectId: string,
    products: readonly MonetizationProduct[],
  ): Promise<MonetizationDesiredState> {
    return this.requestJson(
      projectPath(projectId, 'monetization'),
      jsonRequest('PUT', { products }),
      parseMonetization,
    );
  }

  /*** Inspect monetization against one runtime target and parse the inspection result. */
  inspectMonetization(input: {
    readonly projectId: string;
    readonly runtime: ProjectDeployRuntimeInput;
  }): Promise<ProjectDeployMonetizationInspectionResult> {
    return this.requestJson(
      projectPath(input.projectId, 'monetization/inspect'),
      jsonRequest('POST', input.runtime),
      parseMonetizationInspectionResult,
    );
  }

  /*** Execute an inspected monetization plan and parse the execution result. */
  executeMonetization(input: {
    readonly projectId: string;
    readonly runtime: ProjectDeployRuntimeInput;
    readonly inspection: ProjectMonetizationInspection;
    readonly plan: ProjectMonetizationPlan;
  }): Promise<ProjectMonetizationExecutionResult> {
    return this.requestJson(
      projectPath(input.projectId, 'monetization/execute'),
      jsonRequest('POST', {
        runtime: input.runtime,
        inspection: input.inspection,
        plan: input.plan,
      }),
      parseMonetizationExecutionResult,
    );
  }

  /*** Read and parse authored release desired state. */
  readRelease(projectId: string): Promise<ReleaseDesiredState> {
    return this.requestJson(projectPath(projectId, 'release'), undefined, parseRelease);
  }

  /*** Write authored release desired state and parse the result. */
  writeRelease(projectId: string, release: ProjectReleaseInput): Promise<ReleaseDesiredState> {
    return this.requestJson(
      projectPath(projectId, 'release'),
      jsonRequest('PUT', release),
      parseRelease,
    );
  }

  /*** Read and parse release execution history. */
  listReleaseHistory(projectId: string): Promise<readonly ProjectReleaseHistoryRecord[]> {
    return this.requestJson(projectPath(projectId, 'release/history'), undefined, parseHistory);
  }

  /*** Inspect release state for one runtime target and parse the result. */
  inspectRelease(input: {
    readonly projectId: string;
    readonly runtime: ProjectDeployRuntimeInput;
  }): Promise<ProjectDeployReleaseInspectionResult> {
    return this.requestJson(
      projectPath(input.projectId, 'release/inspect'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input.runtime),
      },
      parseInspection,
    );
  }

  /*** Execute an inspected release plan. */
  executeRelease(input: {
    readonly projectId: string;
    readonly runtime: ProjectDeployRuntimeInput;
    readonly inspection: ProjectReleaseInspection;
    readonly plan: ReleasePlan;
  }): Promise<ProjectDeployReleaseExecutionResponse> {
    return this.postReleaseAction(
      input.projectId,
      'release/execute',
      { runtime: input.runtime, inspection: input.inspection, plan: input.plan },
      parseExecutionResponse,
    );
  }

  /*** Resume a previous release execution. */
  resumeRelease(input: {
    readonly projectId: string;
    readonly runtime: ProjectDeployRuntimeInput;
    readonly previousExecutionId: string;
  }): Promise<ProjectDeployReleaseExecutionResponse> {
    return this.postReleaseAction(
      input.projectId,
      'release/resume',
      { runtime: input.runtime, previousExecutionId: input.previousExecutionId },
      parseExecutionResponse,
    );
  }

  /*** Execute one release lifecycle control. */
  executeReleaseControl(input: {
    readonly projectId: string;
    readonly runtime: ProjectDeployRuntimeInput;
    readonly control: ReleaseLifecycleControl;
  }): Promise<ReleaseControlExecutionResult> {
    return this.postReleaseAction(
      input.projectId,
      'release/control',
      { runtime: input.runtime, control: input.control },
      parseControlResult,
    );
  }

  /***
   * Post a JSON action body to a project release endpoint and parse its response.
   * @utility @ankhorage/utility/http
   */
  private postReleaseAction<T>(
    projectId: string,
    suffix: string,
    body: unknown,
    parse: (value: unknown) => T,
  ): Promise<T> {
    return this.requestJson(
      projectPath(projectId, suffix),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      parse,
    );
  }

  /***
   * Execute a request, decode JSON, run response safety checks, map HTTP errors, and parse the payload.
   * @utility @ankhorage/utility/http
   */
  private async requestJson<T>(
    path: string,
    init: RequestInit | undefined,
    parse: (value: unknown) => T,
  ): Promise<T> {
    const response = await this.request(path, init);
    const value = await readJson(response);
    assertBrowserSafe(value);
    if (!response.ok) {
      throw new ProjectDeployApiError(readError(value), response.status);
    }
    return parse(value);
  }
}

/***
 * Decode an HTTP response as JSON and convert decoding failure to the client's API error.
 * @utility @ankhorage/utility/http
 */
async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ProjectDeployApiError('The Studio host returned a non-JSON Deploy response.', 502);
  }
}

/*** Build the Studio deploy endpoint path for one project and suffix. @todo Keep deploy endpoint routing under src/deploy/. */
function projectPath(projectId: string, suffix: string): string {
  return `/projects/${encodeURIComponent(projectId)}/deploy/${suffix}`;
}

/***
 * Create a JSON RequestInit with method, content type, and serialized body.
 * @utility @ankhorage/utility/http
 */
function jsonRequest(method: 'POST' | 'PUT', body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

/*** Serialize a deploy listing-asset location into endpoint query parameters. @todo Keep deploy protocol serialization under src/deploy/. */
function withAssetLocation(path: string, location: ProjectStoreListingAssetLocation): string {
  const query = new URLSearchParams();
  query.set('kind', location.kind);
  query.set('variant', location.variant);
  if (location.kind === 'screenshot') {
    query.set('target', location.target);
    query.set('locale', location.locale);
    query.set('filename', location.filename);
  }
  return `${path}?${query.toString()}`;
}

/*** Parse the deploy-config response shape. @todo Keep deploy payload validation under src/deploy/ or its owning deploy contract package. */
function parseConfig(value: unknown): AppDeployManifest | null {
  if (value === null) return null;
  const record = asRecord(value);
  if (record === null || asRecord(record.targets) === null) invalid('Deploy config');
  return value as AppDeployManifest;
}

/*** Parse the project store-listing response shape. @todo Keep deploy payload validation under src/deploy/. */
function parseListing(value: unknown): ProjectStoreListing {
  const record = asRecord(value);
  if (
    record === null ||
    typeof record.revision !== 'string' ||
    !Array.isArray(record.locales) ||
    !Array.isArray(record.assetSets)
  ) {
    invalid('Store listing');
  }
  return value as ProjectStoreListing;
}

/*** Parse the monetization desired-state response shape. @todo Keep deploy payload validation under src/deploy/. */
function parseMonetization(value: unknown): MonetizationDesiredState {
  const record = asRecord(value);
  if (record === null || typeof record.revision !== 'string' || !Array.isArray(record.products)) {
    invalid('Monetization');
  }
  return value as MonetizationDesiredState;
}

/*** Parse a success-or-failure monetization inspection response. @todo Keep deploy payload validation under src/deploy/. */
function parseMonetizationInspectionResult(
  value: unknown,
): ProjectDeployMonetizationInspectionResult {
  const record = asRecord(value);
  if (record === null || typeof record.ok !== 'boolean') {
    invalid('Monetization inspection');
  }
  if (!record.ok) {
    parseFailure(record.failure, 'Monetization inspection failure');
    return value as ProjectDeployMonetizationInspectionResult;
  }
  parseMonetizationInspection(record.inspection);
  parseMonetizationPlan(record.plan);
  return value as ProjectDeployMonetizationInspectionResult;
}

/*** Validate a monetization inspection payload. @todo Keep deploy payload validation under src/deploy/. */
function parseMonetizationInspection(value: unknown): void {
  const inspection = asRecord(value);
  if (
    inspection === null ||
    typeof inspection.currentRevision !== 'string' ||
    asRecord(inspection.targets) === null ||
    !Array.isArray(inspection.states) ||
    !Array.isArray(inspection.actions)
  ) {
    invalid('Monetization inspection');
  }
  parseMonetization(inspection.desired);
}

/*** Validate a monetization plan payload. @todo Keep deploy payload validation under src/deploy/. */
function parseMonetizationPlan(value: unknown): void {
  const plan = asRecord(value);
  if (
    plan === null ||
    !isMonetizationPlanStatus(plan.status) ||
    typeof plan.desiredRevision !== 'string' ||
    typeof plan.currentRevision !== 'string' ||
    !Array.isArray(plan.steps) ||
    !Array.isArray(plan.diagnostics) ||
    !Array.isArray(plan.actions)
  ) {
    invalid('Monetization plan');
  }
}

/*** Parse a monetization execution result and validate the payload for its status. @todo Keep deploy payload validation under src/deploy/. */
function parseMonetizationExecutionResult(value: unknown): ProjectMonetizationExecutionResult {
  const result = asRecord(value);
  if (result === null || !isMonetizationExecutionStatus(result.status)) {
    invalid('Monetization execution');
  }
  if (result.status === 'completed') {
    parseMonetizationInspection(result.inspection);
    parseMonetizationPlan(result.plan);
  } else if (result.status === 'action-required') {
    if (!Array.isArray(result.actions)) invalid('Monetization execution');
  } else {
    parseFailure(result.failure, 'Monetization execution failure');
  }
  return value as ProjectMonetizationExecutionResult;
}

/***
 * Test whether an unknown value is one of the monetization plan statuses.
 * @utility @ankhorage/utility/value
 */
function isMonetizationPlanStatus(value: unknown): boolean {
  return value === 'no-change' || value === 'changes' || value === 'blocked';
}

/***
 * Test whether an unknown value is one of the monetization execution statuses.
 * @utility @ankhorage/utility/value
 */
function isMonetizationExecutionStatus(value: unknown): boolean {
  return value === 'completed' || value === 'action-required' || value === 'failed';
}

/*** Parse the prepared release desired-state response shape. @todo Keep deploy payload validation under src/deploy/. */
function parseRelease(value: unknown): ReleaseDesiredState {
  const record = asRecord(value);
  if (
    record === null ||
    typeof record.revision !== 'string' ||
    typeof record.version !== 'string' ||
    !Array.isArray(record.targets) ||
    !Array.isArray(record.notes) ||
    asRecord(record.rollout) === null
  ) {
    invalid('Prepared release');
  }
  return value as ReleaseDesiredState;
}

/*** Parse release history as an array of valid history records. @todo Keep deploy payload validation under src/deploy/. */
function parseHistory(value: unknown): readonly ProjectReleaseHistoryRecord[] {
  if (!Array.isArray(value) || !value.every(isHistoryRecord)) invalid('Release history');
  return value as readonly ProjectReleaseHistoryRecord[];
}

/*** Parse a success-or-failure release inspection response. @todo Keep deploy payload validation under src/deploy/. */
function parseInspection(value: unknown): ProjectDeployReleaseInspectionResult {
  const record = asRecord(value);
  if (record === null || typeof record.ok !== 'boolean') invalid('Release inspection');

  if (!record.ok) {
    const failure = asRecord(record.failure);
    if (
      failure === null ||
      typeof failure.code !== 'string' ||
      typeof failure.message !== 'string'
    ) {
      invalid('Release inspection failure');
    }
    return value as ProjectDeployReleaseInspectionResult;
  }

  const inspection = asRecord(record.inspection);
  const plan = asRecord(record.plan);
  if (
    inspection === null ||
    typeof inspection.currentRevision !== 'string' ||
    !Array.isArray(inspection.actions) ||
    plan === null ||
    typeof plan.status !== 'string' ||
    !Array.isArray(plan.steps) ||
    !Array.isArray(plan.diagnostics)
  ) {
    invalid('Release inspection result');
  }
  return value as ProjectDeployReleaseInspectionResult;
}

/*** Parse a release execution envelope and its nested execution result. @todo Keep deploy payload validation under src/deploy/. */
function parseExecutionResponse(value: unknown): ProjectDeployReleaseExecutionResponse {
  const record = asRecord(value);
  if (record === null || typeof record.executionId !== 'string') {
    invalid('Release execution');
  }
  parseProjectReleaseExecutionResult(record.result);
  return value as ProjectDeployReleaseExecutionResponse;
}

/*** Validate the nested project release execution result and reconciliation payload. @todo Keep deploy payload validation under src/deploy/. */
function parseProjectReleaseExecutionResult(value: unknown): void {
  const result = asRecord(value);
  if (result === null || typeof result.ok !== 'boolean') invalid('Release execution result');
  if (!result.ok) {
    parseFailure(result.failure, 'Release execution failure');
    return;
  }
  const execution = asRecord(result.execution);
  const reconcile = asRecord(execution?.result);
  if (
    execution === null ||
    typeof execution.historyRecorded !== 'boolean' ||
    reconcile === null ||
    !isReconcileStatus(reconcile.status) ||
    typeof reconcile.currentRevision !== 'string' ||
    !Array.isArray(reconcile.executedStepIds)
  ) {
    invalid('Release execution result');
  }
  if (execution.historyFailure !== undefined) {
    parseFailure(execution.historyFailure, 'Release history failure');
  }
}

/*** Parse one release lifecycle-control execution result. @todo Keep deploy payload validation under src/deploy/. */
function parseControlResult(value: unknown): ReleaseControlExecutionResult {
  const result = asRecord(value);
  if (
    result === null ||
    !isControlStatus(result.status) ||
    typeof result.mutationAttempted !== 'boolean'
  ) {
    invalid('Release lifecycle control');
  }
  if (result.status !== 'completed' && typeof result.code !== 'string') {
    invalid('Release lifecycle control');
  }
  return value as ReleaseControlExecutionResult;
}

/***
 * Validate a generic failure payload containing string code and message fields.
 * @utility @ankhorage/utility/validation
 */
function parseFailure(value: unknown, label: string): void {
  const failure = asRecord(value);
  if (failure === null || typeof failure.code !== 'string' || typeof failure.message !== 'string') {
    invalid(label);
  }
}

/***
 * Test whether an unknown value is one of the release reconciliation statuses.
 * @utility @ankhorage/utility/value
 */
function isReconcileStatus(value: unknown): boolean {
  return (
    value === 'completed' ||
    value === 'waiting' ||
    value === 'blocked' ||
    value === 'failed' ||
    value === 'drifted'
  );
}

/***
 * Test whether an unknown value is one of the release lifecycle-control statuses.
 * @utility @ankhorage/utility/value
 */
function isControlStatus(value: unknown): boolean {
  return value === 'completed' || value === 'blocked' || value === 'failed';
}

/*** Validate the minimal release-history record shape used by this deploy client. @todo Keep deploy history contract validation under src/deploy/ or its owning package. */
function isHistoryRecord(value: unknown): boolean {
  const record = asRecord(value);
  const result = asRecord(record?.result);
  return (
    record !== null &&
    typeof record.executionId === 'string' &&
    typeof record.recordedAt === 'string' &&
    result !== null &&
    typeof result.status === 'string'
  );
}

/*** Reject deploy responses that expose forbidden secret-shaped fields. @todo Keep deploy response safety policy under src/deploy/ while using generic nested-key scanning. */
function assertBrowserSafe(value: unknown): void {
  const match = findRawSecretResponseKey(value);
  if (!match) return;

  throw new ProjectDeployApiError(
    `Deploy response contained forbidden secret-shaped field "${match.key}".`,
    502,
  );
}

/***
 * Read a string error field from an unknown response record or return a fallback message.
 * @utility @ankhorage/utility/error
 */
function readError(value: unknown): string {
  const record = asRecord(value);
  return typeof record?.error === 'string' ? record.error : 'The Studio Deploy request failed.';
}

/*** Throw the deploy client's canonical invalid-response error for a labeled payload. @todo Keep deploy-specific error construction under src/deploy/. */
function invalid(label: string): never {
  throw new ProjectDeployApiError(`${label} response was invalid.`, 502);
}

/***
 * Narrow an unknown non-array object to a string-keyed record.
 * @utility @ankhorage/utility/value
 */
function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
