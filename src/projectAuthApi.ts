import type { StudioAuthSettings } from './authSettings';
import { validateStudioAuthSettings } from './authSettings';
import type {
  ProjectAuthDiagnostic,
  ProjectAuthDiagnosticSeverity,
  ProjectAuthHealth,
  ProjectAuthHealthStatus,
  ProjectOAuthProviderHealth,
  ProjectOAuthProviderHealthStatus,
} from './projectAuthHealth';
import { findRawSecretResponseKey } from './secretResponseGuard';

export class ProjectAuthApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(args: { readonly code: string; readonly message: string; readonly status: number }) {
    super(args.message);
    this.name = 'ProjectAuthApiError';
    this.code = args.code;
    this.status = args.status;
  }
}

export async function getProjectAuthHealth(input: {
  readonly projectId: string;
  readonly environment?: string;
}): Promise<ProjectAuthHealth> {
  const query = createQuery({ environment: input.environment });
  const value = await requestJson(
    `/projects/${encodeURIComponent(input.projectId)}/auth/health${query}`,
  );
  return parseProjectAuthHealthResponse(value);
}

export function parseProjectAuthSettingsResponse(
  value: unknown,
  expectedState: 'loaded' | 'saved',
): StudioAuthSettings | null {
  rejectRawSecretResponse(value, 'Project auth response was invalid.');
  const record = asRecord(value);
  if (record?.ok !== true || record.state !== expectedState) {
    throw invalidResponse('Project auth response was invalid.');
  }
  if (record.data === null && expectedState === 'loaded') return null;

  const parsed = validateStudioAuthSettings(record.data);
  if (!parsed.ok) throw invalidResponse(parsed.error.message);
  return parsed.data;
}

export function parseProjectAuthHealthResponse(value: unknown): ProjectAuthHealth {
  rejectRawSecretResponse(value, 'Project auth health response was invalid.');
  const record = asRecord(value);
  if (record?.ok !== true || record.state !== 'loaded') {
    throw invalidResponse('Project auth health response was invalid.');
  }
  return parseProjectAuthHealth(record.data);
}

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  const { API_BASE } = await import('./core/constants');
  const response = await fetch(`${API_BASE}${path}`, init);
  const value = await readJson(response);
  if (!response.ok) throw parseHttpError(value, response.status);
  return value;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ProjectAuthApiError({
      code: 'invalid_response',
      message: 'The Studio host returned a non-JSON auth response.',
      status: response.status,
    });
  }
}

function parseHttpError(value: unknown, status: number): ProjectAuthApiError {
  return parseProjectAuthHttpErrorResponse(value, status);
}

export function parseProjectAuthHttpErrorResponse(
  value: unknown,
  status: number,
): ProjectAuthApiError {
  rejectRawSecretResponse(value, 'Project auth error response was invalid.');
  const record = asRecord(value);
  const error = asRecord(record?.error);
  return new ProjectAuthApiError({
    code: typeof error?.code === 'string' ? error.code : 'request_failed',
    message:
      typeof error?.message === 'string'
        ? error.message
        : 'The Studio authentication configuration request failed.',
    status,
  });
}

function invalidResponse(message: string): ProjectAuthApiError {
  return new ProjectAuthApiError({ code: 'invalid_response', message, status: 502 });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseProjectAuthHealth(value: unknown): ProjectAuthHealth {
  const record = asRecord(value);
  const callbackUrls = asRecord(record?.callbackUrls);
  if (
    record === null ||
    !isProjectAuthHealthStatus(record.status) ||
    !Array.isArray(record.diagnostics) ||
    !Array.isArray(record.providers) ||
    callbackUrls === null ||
    typeof callbackUrls.appCallbackRoute !== 'string' ||
    (callbackUrls.providerRedirectUrl !== undefined &&
      typeof callbackUrls.providerRedirectUrl !== 'string')
  ) {
    throw invalidResponse('Project auth health data was invalid.');
  }

  return {
    status: record.status,
    diagnostics: record.diagnostics.map(parseProjectAuthDiagnostic),
    providers: record.providers.map(parseProjectOAuthProviderHealth),
    callbackUrls: {
      appCallbackRoute: callbackUrls.appCallbackRoute,
      ...(typeof callbackUrls.providerRedirectUrl === 'string'
        ? { providerRedirectUrl: callbackUrls.providerRedirectUrl }
        : {}),
    },
  };
}

function parseProjectAuthDiagnostic(value: unknown): ProjectAuthDiagnostic {
  const record = asRecord(value);
  if (
    record === null ||
    typeof record.code !== 'string' ||
    !isProjectAuthDiagnosticSeverity(record.severity) ||
    typeof record.message !== 'string' ||
    (record.path !== undefined && typeof record.path !== 'string') ||
    (record.providerId !== undefined && typeof record.providerId !== 'string') ||
    (record.credentialsRef !== undefined && typeof record.credentialsRef !== 'string')
  ) {
    throw invalidResponse('Project auth diagnostic was invalid.');
  }

  return {
    code: record.code,
    severity: record.severity,
    message: record.message,
    ...(typeof record.path === 'string' ? { path: record.path } : {}),
    ...(typeof record.providerId === 'string' ? { providerId: record.providerId } : {}),
    ...(typeof record.credentialsRef === 'string' ? { credentialsRef: record.credentialsRef } : {}),
  };
}

function parseProjectOAuthProviderHealth(value: unknown): ProjectOAuthProviderHealth {
  const record = asRecord(value);
  if (
    record === null ||
    typeof record.providerId !== 'string' ||
    typeof record.label !== 'string' ||
    typeof record.enabled !== 'boolean' ||
    (record.credentialsRef !== undefined && typeof record.credentialsRef !== 'string') ||
    !isProjectOAuthProviderHealthStatus(record.status) ||
    !isStringArray(record.requiredFields) ||
    !isStringArray(record.configuredFields) ||
    !isStringArray(record.missingFields)
  ) {
    throw invalidResponse('Project OAuth provider health was invalid.');
  }

  return {
    providerId: record.providerId,
    label: record.label,
    enabled: record.enabled,
    ...(typeof record.credentialsRef === 'string' ? { credentialsRef: record.credentialsRef } : {}),
    status: record.status,
    requiredFields: [...record.requiredFields],
    configuredFields: [...record.configuredFields],
    missingFields: [...record.missingFields],
  };
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

function rejectRawSecretResponse(value: unknown, message: string): void {
  const match = findRawSecretResponseKey(value);
  if (match) {
    throw invalidResponse(
      `${message} Raw secret-shaped response field "${match.key}" was present.`,
    );
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isProjectAuthHealthStatus(value: unknown): value is ProjectAuthHealthStatus {
  return (
    value === 'healthy' || value === 'warning' || value === 'error' || value === 'unconfigured'
  );
}

function isProjectAuthDiagnosticSeverity(value: unknown): value is ProjectAuthDiagnosticSeverity {
  return value === 'info' || value === 'warning' || value === 'error';
}

function isProjectOAuthProviderHealthStatus(
  value: unknown,
): value is ProjectOAuthProviderHealthStatus {
  return (
    value === 'disabled' ||
    value === 'configured' ||
    value === 'incomplete' ||
    value === 'missing' ||
    value === 'invalid'
  );
}
