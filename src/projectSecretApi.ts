import type { AuthOAuthProviderId } from '@ankhorage/contracts';
import type { SecretMetadata, SecretPayload } from '@ankhorage/contracts/secrets';

import {
  type ProjectSecretUsage,
  type ProjectSecretUsageCategory,
  type ProjectSecretUsageSummary,
} from './projectSecretUsage';
import { findRawSecretResponseKey } from './secretResponseGuard';

export interface ProjectSecretCreateInput {
  readonly projectId: string;
  readonly environment?: string;
  readonly ref: string;
  readonly kind: string;
  readonly provider?: string;
  readonly payload: SecretPayload;
}

export interface ProjectSecretReplaceInput {
  readonly projectId: string;
  readonly environment?: string;
  readonly ref: string;
  readonly payload: SecretPayload;
}

export interface ProjectSecretRemoveInput {
  readonly projectId: string;
  readonly environment?: string;
  readonly ref: string;
  readonly confirmBrokenReferences?: boolean;
}

export interface ConfigureProjectOAuthProviderInput {
  readonly projectId: string;
  readonly providerId: AuthOAuthProviderId;
  readonly environment?: string;
  readonly credentialsRef?: string;
  readonly enabled?: boolean;
  readonly label?: string;
  readonly scopes?: readonly string[];
  readonly callbackRoute?: string;
  readonly payload: SecretPayload;
}

export type ConfigureProjectOAuthProviderResponse =
  | {
      readonly ok: true;
      readonly state: 'saved';
      readonly metadata: SecretMetadata;
      readonly credentialsRef: string;
    }
  | {
      readonly ok: false;
      readonly state: 'secret_write_failed' | 'secret_saved_manifest_failed';
      readonly error: { readonly code: string; readonly message: string };
      readonly metadata?: SecretMetadata;
      readonly credentialsRef?: string;
    };

export class ProjectSecretApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly data?: unknown;

  constructor(args: {
    readonly code: string;
    readonly message: string;
    readonly status: number;
    readonly data?: unknown;
  }) {
    super(args.message);
    this.name = 'ProjectSecretApiError';
    this.code = args.code;
    this.status = args.status;
    this.data = args.data;
  }
}

export async function listProjectSecrets(input: {
  readonly projectId: string;
  readonly environment?: string;
  readonly kind?: string;
  readonly provider?: string;
}): Promise<readonly SecretMetadata[]> {
  const query = createQuery({
    environment: input.environment,
    kind: input.kind,
    provider: input.provider,
  });
  const value = await requestJson(
    `/projects/${encodeURIComponent(input.projectId)}/secrets${query}`,
  );
  return parseProjectSecretListResponse(value);
}

export async function createProjectSecret(
  input: ProjectSecretCreateInput,
): Promise<SecretMetadata> {
  const value = await requestJson(`/projects/${encodeURIComponent(input.projectId)}/secrets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      environment: input.environment,
      ref: input.ref,
      kind: input.kind,
      provider: input.provider,
      payload: input.payload,
    }),
  });
  return parseProjectSecretMetadataResponse(value);
}

export async function replaceProjectSecret(
  input: ProjectSecretReplaceInput,
): Promise<SecretMetadata> {
  const value = await requestJson(`/projects/${encodeURIComponent(input.projectId)}/secrets`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      environment: input.environment,
      ref: input.ref,
      payload: input.payload,
    }),
  });
  return parseProjectSecretMetadataResponse(value);
}

export async function getProjectSecretUsages(input: {
  readonly projectId: string;
  readonly environment?: string;
  readonly ref: string;
}): Promise<ProjectSecretUsageSummary> {
  const query = createQuery({ environment: input.environment, ref: input.ref });
  const value = await requestJson(
    `/projects/${encodeURIComponent(input.projectId)}/secrets/usages${query}`,
  );
  return parseProjectSecretUsageSummaryResponse(value);
}

export async function removeProjectSecret(
  input: ProjectSecretRemoveInput,
): Promise<ProjectSecretUsageSummary> {
  const query = createQuery({
    environment: input.environment,
    ref: input.ref,
    confirmBrokenReferences: input.confirmBrokenReferences ? 'true' : undefined,
  });
  const value = await requestJson(
    `/projects/${encodeURIComponent(input.projectId)}/secrets${query}`,
    { method: 'DELETE' },
  );
  return parseProjectSecretRemoveResponse(value);
}

export async function configureProjectOAuthProvider(
  input: ConfigureProjectOAuthProviderInput,
): Promise<ConfigureProjectOAuthProviderResponse> {
  const value = await requestJson(
    `/projects/${encodeURIComponent(input.projectId)}/auth/oauth/${encodeURIComponent(input.providerId)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        environment: input.environment,
        credentialsRef: input.credentialsRef,
        enabled: input.enabled,
        label: input.label,
        scopes: input.scopes,
        callbackRoute: input.callbackRoute,
        payload: input.payload,
      }),
    },
    true,
  );
  return parseConfigureProjectOAuthProviderResponse(value);
}

export function parseProjectSecretListResponse(value: unknown): readonly SecretMetadata[] {
  rejectRawSecretResponse(value, 'Secret list response was invalid.');
  const result = readResult(value);
  if (!result.ok || !Array.isArray(result.data)) {
    throw createInvalidResponseError('Secret list response was invalid.');
  }
  return result.data.map(parseSecretMetadata);
}

export function parseProjectSecretMetadataResponse(value: unknown): SecretMetadata {
  rejectRawSecretResponse(value, 'Secret metadata response was invalid.');
  const result = readResult(value);
  if (!result.ok) {
    throw createInvalidResponseError('Secret metadata response was invalid.');
  }
  return parseSecretMetadata(result.data);
}

export function parseProjectSecretUsageSummaryResponse(value: unknown): ProjectSecretUsageSummary {
  rejectRawSecretResponse(value, 'Secret usage response was invalid.');
  const result = readResult(value);
  if (!result.ok) {
    throw createInvalidResponseError('Secret usage response was invalid.');
  }
  return parseProjectSecretUsageSummary(result.data);
}

function parseProjectSecretRemoveResponse(value: unknown): ProjectSecretUsageSummary {
  rejectRawSecretResponse(value, 'Secret removal response was invalid.');
  const result = readResult(value);
  if (!result.ok) {
    throw createInvalidResponseError('Secret removal response was invalid.');
  }
  return parseProjectSecretUsageSummary(result.data);
}

export function parseConfigureProjectOAuthProviderResponse(
  value: unknown,
): ConfigureProjectOAuthProviderResponse {
  rejectRawSecretResponse(value, 'OAuth configuration response was invalid.');
  const record = asRecord(value);
  if (record === null || typeof record.ok !== 'boolean') {
    throw createInvalidResponseError('OAuth configuration response was invalid.');
  }

  if (record.ok) {
    if (record.state !== 'saved' || typeof record.credentialsRef !== 'string') {
      throw createInvalidResponseError('OAuth configuration response was invalid.');
    }
    return {
      ok: true,
      state: 'saved',
      metadata: parseSecretMetadata(record.metadata),
      credentialsRef: record.credentialsRef,
    };
  }

  if (record.state !== 'secret_write_failed' && record.state !== 'secret_saved_manifest_failed') {
    throw createInvalidResponseError('OAuth configuration response was invalid.');
  }

  return {
    ok: false,
    state: record.state,
    error: parseError(record.error),
    ...(record.metadata === undefined ? {} : { metadata: parseSecretMetadata(record.metadata) }),
    ...(typeof record.credentialsRef === 'string' ? { credentialsRef: record.credentialsRef } : {}),
  };
}

async function requestJson(
  path: string,
  init?: RequestInit,
  allowStructuredFailure = false,
): Promise<unknown> {
  const { API_BASE } = await import('./core/constants');
  const response = await fetch(`${API_BASE}${path}`, init);
  const value = await readJson(response);

  if (!response.ok && !allowStructuredFailure) {
    throw parseHttpError(value, response.status);
  }
  if (!response.ok && allowStructuredFailure) {
    const record = asRecord(value);
    if (record?.ok !== false) {
      throw parseHttpError(value, response.status);
    }
  }

  return value;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ProjectSecretApiError({
      code: 'invalid_response',
      message: 'The Studio host returned a non-JSON secret response.',
      status: response.status,
    });
  }
}

function parseHttpError(value: unknown, status: number): ProjectSecretApiError {
  return parseProjectSecretHttpErrorResponse(value, status);
}

export function parseProjectSecretHttpErrorResponse(
  value: unknown,
  status: number,
): ProjectSecretApiError {
  rejectRawSecretResponse(value, 'Secret error response was invalid.');
  const record = asRecord(value);
  const errorRecord = asRecord(record?.error);
  const data = record?.data;
  const code =
    typeof errorRecord?.code === 'string'
      ? errorRecord.code
      : typeof record?.code === 'string'
        ? record.code
        : 'request_failed';
  const message =
    typeof errorRecord?.message === 'string'
      ? errorRecord.message
      : typeof record?.error === 'string'
        ? record.error
        : 'The Studio secret request failed.';
  return new ProjectSecretApiError({ code, message, status, data });
}

function readResult(value: unknown): { readonly ok: boolean; readonly data?: unknown } {
  const record = asRecord(value);
  if (record === null || typeof record.ok !== 'boolean') {
    throw createInvalidResponseError('Secret-store response was invalid.');
  }
  return { ok: record.ok, data: record.data };
}

function parseSecretMetadata(value: unknown): SecretMetadata {
  const record = asRecord(value);
  if (record === null) {
    throw createInvalidResponseError('Secret metadata was invalid.');
  }

  const scope = asRecord(record.scope);
  if (
    typeof record.ref !== 'string' ||
    scope === null ||
    typeof scope.projectId !== 'string' ||
    typeof scope.environment !== 'string' ||
    typeof record.kind !== 'string' ||
    (record.provider !== undefined && typeof record.provider !== 'string') ||
    !isStringArray(record.configuredFields) ||
    typeof record.createdAt !== 'string' ||
    typeof record.updatedAt !== 'string'
  ) {
    throw createInvalidResponseError('Secret metadata was invalid.');
  }

  return {
    ref: record.ref,
    scope: { projectId: scope.projectId, environment: scope.environment },
    kind: record.kind,
    ...(typeof record.provider === 'string' ? { provider: record.provider } : {}),
    configuredFields: [...record.configuredFields],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function parseProjectSecretUsageSummary(value: unknown): ProjectSecretUsageSummary {
  const record = asRecord(value);
  if (record === null || typeof record.ref !== 'string' || !Array.isArray(record.usages)) {
    throw createInvalidResponseError('Secret usage summary was invalid.');
  }
  return {
    ref: record.ref,
    usages: record.usages.map(parseProjectSecretUsage),
  };
}

function parseProjectSecretUsage(value: unknown): ProjectSecretUsage {
  const record = asRecord(value);
  if (
    record === null ||
    typeof record.ref !== 'string' ||
    typeof record.path !== 'string' ||
    !isProjectSecretUsageCategory(record.category) ||
    typeof record.label !== 'string' ||
    (record.ownerId !== undefined && typeof record.ownerId !== 'string') ||
    typeof record.breaksWhenMissing !== 'boolean'
  ) {
    throw createInvalidResponseError('Secret usage was invalid.');
  }

  return {
    ref: record.ref,
    path: record.path,
    category: record.category,
    label: record.label,
    ...(typeof record.ownerId === 'string' ? { ownerId: record.ownerId } : {}),
    breaksWhenMissing: record.breaksWhenMissing,
  };
}

function parseError(value: unknown): { readonly code: string; readonly message: string } {
  const record = asRecord(value);
  if (record === null || typeof record.code !== 'string' || typeof record.message !== 'string') {
    throw createInvalidResponseError('Secret error response was invalid.');
  }
  return { code: record.code, message: record.message };
}

function createQuery(values: Readonly<Record<string, string | undefined>>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    const normalized = value?.trim();
    if (normalized) params.set(key, normalized);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function createInvalidResponseError(message: string): ProjectSecretApiError {
  return new ProjectSecretApiError({ code: 'invalid_response', message, status: 502 });
}

function rejectRawSecretResponse(value: unknown, message: string): void {
  const match = findRawSecretResponseKey(value);
  if (match) {
    throw createInvalidResponseError(
      `${message} Raw secret-shaped response field "${match.key}" was present.`,
    );
  }
}

function isProjectSecretUsageCategory(value: unknown): value is ProjectSecretUsageCategory {
  return value === 'oauth-provider' || value === 'project-config';
}
