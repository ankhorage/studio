import {
  APP_DEPLOY_ENVIRONMENT_IDS,
  APP_DEPLOY_TARGET_IDS,
  type AppDeployEnvironmentId,
  type AppDeployTargetId,
} from '@ankhorage/contracts/deploy';

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

  /*** Create a typed project-auth API error with a stable code and HTTP status. */
  constructor(args: { readonly code: string; readonly message: string; readonly status: number }) {
    super(args.message);
    this.name = 'ProjectAuthApiError';
    this.code = args.code;
    this.status = args.status;
  }
}

/***
 * Fetch and validate auth-health state for one project and optional deploy environment.
 * @todo Move project-auth HTTP access from the source root into the auth package-edge adapter.
 */
export async function getProjectAuthHealth(input: {
  readonly projectId: string;
  readonly environment?: AppDeployEnvironmentId;
}): Promise<ProjectAuthHealth> {
  const query = createQuery({ environment: input.environment });
  const value = await requestJson(
    `/projects/${encodeURIComponent(input.projectId)}/auth/health${query}`,
  );
  return parseProjectAuthHealthResponse(value);
}

/*** Validate the auth-health response envelope before parsing the contained project auth state. */
export function parseProjectAuthHealthResponse(value: unknown): ProjectAuthHealth {
  rejectRawSecretResponse(value, 'Project auth health response was invalid.');
  const record = asRecord(value);
  if (record?.ok !== true || record.state !== 'loaded') {
    throw invalidResponse('Project auth health response was invalid.');
  }
  return parseProjectAuthHealth(record.data);
}

/***
 * Fetch a Studio-host path, decode JSON, and translate unsuccessful HTTP responses through a caller-owned error parser.
 * @utility @ankhorage/utility/http
 */
async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  const { API_BASE } = await import('./core/constants');
  const response = await fetch(`${API_BASE}${path}`, init);
  const value = await readJson(response);
  if (!response.ok) throw parseHttpError(value, response.status);
  return value;
}

/***
 * Decode a Response body as JSON while preserving the response status for decode failures.
 * @utility @ankhorage/utility/http
 */
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

/*** Convert an unsuccessful auth HTTP payload into the typed project-auth API error contract. */
function parseHttpError(value: unknown, status: number): ProjectAuthApiError {
  return parseProjectAuthHttpErrorResponse(value, status);
}

/*** Validate a raw-secret-safe auth error response and project it into ProjectAuthApiError. */
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

/***
 * Create a typed invalid-upstream-response error with a fixed bad-gateway status.
 * @utility @ankhorage/utility/http
 */
function invalidResponse(message: string): ProjectAuthApiError {
  return new ProjectAuthApiError({ code: 'invalid_response', message, status: 502 });
}

/***
 * Narrow an unknown value to a strict non-array record or return null.
 * @utility @ankhorage/utility/value
 */
function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/*** Validate and normalize the project-auth health payload inside a successful host response. */
function parseProjectAuthHealth(value: unknown): ProjectAuthHealth {
  const record = asRecord(value);
  const setup = asRecord(record?.setup);
  const callbackUrls = asRecord(record?.callbackUrls);
  if (
    record === null ||
    !isProjectAuthHealthStatus(record.status) ||
    !Array.isArray(record.diagnostics) ||
    !Array.isArray(record.providers) ||
    setup === null ||
    !isAppDeployEnvironmentId(setup.environment) ||
    !isAppDeployTargetIdArray(setup.targets) ||
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
    setup: {
      environment: setup.environment,
      targets: [...setup.targets],
    },
    callbackUrls: {
      appCallbackRoute: callbackUrls.appCallbackRoute,
      ...(typeof callbackUrls.providerRedirectUrl === 'string'
        ? { providerRedirectUrl: callbackUrls.providerRedirectUrl }
        : {}),
    },
  };
}

/*** Validate and normalize one project-auth diagnostic from an unknown host payload. */
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

/*** Validate and normalize one OAuth-provider health record from an unknown host payload. */
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

/***
 * Serialize defined non-empty string values into an optional URL query string.
 * @utility @ankhorage/utility/url
 */
function createQuery(values: Readonly<Record<string, string | undefined>>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    const normalized = value?.trim();
    if (normalized) params.set(key, normalized);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

/***
 * Reject an unknown response when a nested forbidden-key detector reports a match.
 * @utility @ankhorage/utility/validation
 */
function rejectRawSecretResponse(value: unknown, message: string): void {
  const match = findRawSecretResponseKey(value);
  if (match) {
    throw invalidResponse(
      `${message} Raw secret-shaped response field "${match.key}" was present.`,
    );
  }
}

/***
 * Return whether an unknown value is an array containing only strings.
 * @utility @ankhorage/utility/array
 */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

/***
 * Return whether a value belongs to the canonical deploy-environment identifier set.
 * @todo Move this reusable guard to the deploy contracts owner beside APP_DEPLOY_ENVIRONMENT_IDS.
 */
function isAppDeployEnvironmentId(value: unknown): value is AppDeployEnvironmentId {
  return (
    typeof value === 'string' &&
    APP_DEPLOY_ENVIRONMENT_IDS.includes(value as AppDeployEnvironmentId)
  );
}

/***
 * Return whether every array entry belongs to the canonical deploy-target identifier set.
 * @todo Move this reusable guard to the deploy contracts owner beside APP_DEPLOY_TARGET_IDS.
 */
function isAppDeployTargetIdArray(value: unknown): value is AppDeployTargetId[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        typeof entry === 'string' && APP_DEPLOY_TARGET_IDS.includes(entry as AppDeployTargetId),
    )
  );
}

/*** Return whether an unknown value is one of the project-auth aggregate health statuses. */
function isProjectAuthHealthStatus(value: unknown): value is ProjectAuthHealthStatus {
  return (
    value === 'healthy' || value === 'warning' || value === 'error' || value === 'unconfigured'
  );
}

/*** Return whether an unknown value is a supported project-auth diagnostic severity. */
function isProjectAuthDiagnosticSeverity(value: unknown): value is ProjectAuthDiagnosticSeverity {
  return value === 'info' || value === 'warning' || value === 'error';
}

/*** Return whether an unknown value is a supported OAuth-provider health status. */
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
