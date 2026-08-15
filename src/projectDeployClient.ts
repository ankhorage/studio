import type { AppDeployManifest } from '@ankhorage/contracts/deploy';
import type { MonetizationDesiredState, ReleaseDesiredState } from '@ankhorage/deploy';
import type { ProjectReleaseHistoryRecord, ProjectStoreListing } from '@ankhorage/deploy/project';

import type { ProjectDeployRuntimeInput } from './host/deploy/ProjectDeployRuntimeInput';
import { ProjectDeployApiError } from './projectDeployApiError';
import type { ProjectDeployReleaseInspectionResult } from './projectDeployReleaseInspectionResult';
import type { ProjectDeployRequest } from './projectDeployRequest';
import { findRawSecretResponseKey } from './secretResponseGuard';

export class ProjectDeployClient {
  constructor(private readonly request: ProjectDeployRequest) {}

  readConfig(projectId: string): Promise<AppDeployManifest | null> {
    return this.requestJson(projectPath(projectId, 'config'), undefined, parseConfig);
  }

  readListing(projectId: string): Promise<ProjectStoreListing> {
    return this.requestJson(projectPath(projectId, 'listing'), undefined, parseListing);
  }

  readMonetization(projectId: string): Promise<MonetizationDesiredState> {
    return this.requestJson(projectPath(projectId, 'monetization'), undefined, parseMonetization);
  }

  readRelease(projectId: string): Promise<ReleaseDesiredState> {
    return this.requestJson(projectPath(projectId, 'release'), undefined, parseRelease);
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

function projectPath(projectId: string, suffix: string): string {
  return `/projects/${encodeURIComponent(projectId)}/deploy/${suffix}`;
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
