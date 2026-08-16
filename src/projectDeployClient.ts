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
  ProjectReleaseHistoryRecord,
  ProjectReleaseInput,
  ProjectReleaseInspection,
  ProjectStoreListing,
  ProjectStoreListingAssetLocation,
  StoreListingLocale,
} from '@ankhorage/deploy/project';

import { ProjectDeployApiError } from './projectDeployApiError';
import type { ProjectDeployReleaseExecutionResponse } from './projectDeployReleaseExecutionResponse';
import type { ProjectDeployReleaseInspectionResult } from './projectDeployReleaseInspectionResult';
import type { ProjectDeployRequest } from './projectDeployRequest';
import type { ProjectDeployRuntimeInput } from './projectDeployRuntimeInput';
import { findRawSecretResponseKey } from './secretResponseGuard';

export class ProjectDeployClient {
  constructor(private readonly request: ProjectDeployRequest) {}

  readConfig(projectId: string): Promise<AppDeployManifest | null> {
    return this.requestJson(projectPath(projectId, 'config'), undefined, parseConfig);
  }

  readListing(projectId: string): Promise<ProjectStoreListing> {
    return this.requestJson(projectPath(projectId, 'listing'), undefined, parseListing);
  }

  writeListingLocale(projectId: string, locale: StoreListingLocale): Promise<ProjectStoreListing> {
    return this.requestJson(
      projectPath(projectId, 'listing/locale'),
      jsonRequest('PUT', locale),
      parseListing,
    );
  }

  removeListingLocale(projectId: string, locale: string): Promise<ProjectStoreListing> {
    return this.requestJson(
      `${projectPath(projectId, 'listing/locale')}/${encodeURIComponent(locale)}`,
      { method: 'DELETE' },
      parseListing,
    );
  }

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
        body: copyToArrayBuffer(data),
      },
      parseListing,
    );
  }

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

  readMonetization(projectId: string): Promise<MonetizationDesiredState> {
    return this.requestJson(projectPath(projectId, 'monetization'), undefined, parseMonetization);
  }

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

  readRelease(projectId: string): Promise<ReleaseDesiredState> {
    return this.requestJson(projectPath(projectId, 'release'), undefined, parseRelease);
  }

  writeRelease(projectId: string, release: ProjectReleaseInput): Promise<ReleaseDesiredState> {
    return this.requestJson(
      projectPath(projectId, 'release'),
      jsonRequest('PUT', release),
      parseRelease,
    );
  }

  listReleaseHistory(projectId: string): Promise<readonly ProjectReleaseHistoryRecord[]> {
    return this.requestJson(projectPath(projectId, 'release/history'), undefined, parseHistory);
  }

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

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ProjectDeployApiError('The Studio host returned a non-JSON Deploy response.', 502);
  }
}

function copyToArrayBuffer(data: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);
  return buffer;
}

function projectPath(projectId: string, suffix: string): string {
  return `/projects/${encodeURIComponent(projectId)}/deploy/${suffix}`;
}

function jsonRequest(method: 'POST' | 'PUT', body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

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

function parseConfig(value: unknown): AppDeployManifest | null {
  if (value === null) return null;
  const record = asRecord(value);
  if (record === null || asRecord(record.targets) === null) invalid('Deploy config');
  return value as AppDeployManifest;
}

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

function parseMonetization(value: unknown): MonetizationDesiredState {
  const record = asRecord(value);
  if (record === null || typeof record.revision !== 'string' || !Array.isArray(record.products)) {
    invalid('Monetization');
  }
  return value as MonetizationDesiredState;
}

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

function parseHistory(value: unknown): readonly ProjectReleaseHistoryRecord[] {
  if (!Array.isArray(value) || !value.every(isHistoryRecord)) invalid('Release history');
  return value as readonly ProjectReleaseHistoryRecord[];
}

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

function parseExecutionResponse(value: unknown): ProjectDeployReleaseExecutionResponse {
  const record = asRecord(value);
  if (record === null || typeof record.executionId !== 'string') {
    invalid('Release execution');
  }
  parseProjectReleaseExecutionResult(record.result);
  return value as ProjectDeployReleaseExecutionResponse;
}

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

function parseFailure(value: unknown, label: string): void {
  const failure = asRecord(value);
  if (failure === null || typeof failure.code !== 'string' || typeof failure.message !== 'string') {
    invalid(label);
  }
}

function isReconcileStatus(value: unknown): boolean {
  return (
    value === 'completed' ||
    value === 'waiting' ||
    value === 'blocked' ||
    value === 'failed' ||
    value === 'drifted'
  );
}

function isControlStatus(value: unknown): boolean {
  return value === 'completed' || value === 'blocked' || value === 'failed';
}

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

function assertBrowserSafe(value: unknown): void {
  const match = findRawSecretResponseKey(value);
  if (!match) return;

  throw new ProjectDeployApiError(
    `Deploy response contained forbidden secret-shaped field "${match.key}".`,
    502,
  );
}

function readError(value: unknown): string {
  const record = asRecord(value);
  return typeof record?.error === 'string' ? record.error : 'The Studio Deploy request failed.';
}

function invalid(label: string): never {
  throw new ProjectDeployApiError(`${label} response was invalid.`, 502);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
