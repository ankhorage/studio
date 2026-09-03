import type { DataContractValue, DataSourceDiagnostic } from '@ankhorage/contracts/data';

import { API_BASE } from './core/constants';
import type {
  ExternalApiConnectRequest,
  ExternalApiConnectResult,
  ExternalApiDiscoveryAttempt,
  ExternalApiOperationTestRequest,
  ExternalApiOperationTestResult,
  ManualRestApiRequest,
} from './externalApiAuthoringContracts';

/***
 * Represent an unsuccessful or invalid External API host response with its HTTP status.
 * @todo Rename this error to remove the duplicated `ApiApi` wording when the External API domain is migrated.
 */
class ExternalApiApiError extends Error {
  readonly status: number;

  /*** Create an External API client error with the associated HTTP status. */
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ExternalApiApiError';
    this.status = status;
  }
}

/***
 * Ask the Studio host to discover and connect an external API definition.
 * @todo Move External API HTTP access from the source root into the external-apis package-edge adapter.
 */
export function connectExternalApi(
  projectId: string,
  request: ExternalApiConnectRequest,
): Promise<ExternalApiConnectResult> {
  return requestResult(projectId, 'connect', request, parseConnectResult);
}

/***
 * Create a manually authored REST API definition through the Studio host.
 * @todo Move External API HTTP access from the source root into the external-apis package-edge adapter.
 */
export function createManualRestApi(
  projectId: string,
  request: ManualRestApiRequest,
): Promise<ExternalApiConnectResult> {
  return requestResult(projectId, 'manual-rest', request, parseConnectResult);
}

/***
 * Execute one authored external API operation through the Studio host test endpoint.
 * @todo Move External API operation testing into the external-apis application responsibility.
 */
export function testExternalApiOperation(
  projectId: string,
  request: ExternalApiOperationTestRequest,
): Promise<ExternalApiOperationTestResult> {
  return requestResult(projectId, 'test', request, parseTestResult);
}

/***
 * POST a JSON body to an encoded resource action, decode JSON, permit structured failures, and parse the result.
 * @utility @ankhorage/utility/http
 */
async function requestResult<TResult>(
  projectId: string,
  action: string,
  body: unknown,
  parse: (value: unknown) => TResult,
): Promise<TResult> {
  const response = await fetch(
    `${API_BASE}/projects/${encodeURIComponent(projectId)}/apis/${action}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  const value = await readJson(response);
  if (!response.ok && !isStructuredFailure(value)) {
    throw new ExternalApiApiError('The Studio external API request failed.', response.status);
  }
  return parse(value);
}

/***
 * Decode a Response body as JSON and retain its status when decoding fails.
 * @utility @ankhorage/utility/http
 */
async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ExternalApiApiError('The Studio host returned a non-JSON response.', response.status);
  }
}

/*** Validate and normalize the result of external API discovery/connection. */
function parseConnectResult(value: unknown): ExternalApiConnectResult {
  const record = requireResultRecord(value);
  const diagnostics = parseDiagnostics(record.diagnostics);
  const attempts = parseAttempts(record.attempts);
  if (!record.ok) return { ok: false, diagnostics, attempts };
  if (
    typeof record.apiId !== 'string' ||
    !isConnectedProtocol(record.protocol) ||
    typeof record.created !== 'boolean'
  ) {
    throw invalidResponse();
  }
  return {
    ok: true,
    apiId: record.apiId,
    protocol: record.protocol,
    created: record.created,
    diagnostics,
    attempts,
  };
}

/*** Validate and normalize the result of testing one external API operation. */
function parseTestResult(value: unknown): ExternalApiOperationTestResult {
  const record = requireResultRecord(value);
  const diagnostics = parseDiagnostics(record.diagnostics);
  const request = parseRequestSummary(record.request);
  const response = parseResponseSummary(record.response);
  if (!record.ok) return { ok: false, request, response, diagnostics };
  if (!request) throw invalidResponse();
  const data = isDataContractValue(record.data) ? record.data : undefined;
  return { ok: true, request, response, data, diagnostics };
}

/***
 * Require a record carrying a boolean `ok` discriminator and preserve its remaining fields.
 * @utility @ankhorage/utility/validation
 */
function requireResultRecord(value: unknown): Record<string, unknown> & { readonly ok: boolean } {
  const record = readRecord(value);
  if (!record || typeof record.ok !== 'boolean') throw invalidResponse();
  return { ...record, ok: record.ok };
}

/***
 * Validate DataSourceDiagnostic payloads returned by external API authoring operations.
 * @todo Move reusable DataSourceDiagnostic parsing beside its contracts/data owner.
 */
function parseDiagnostics(value: unknown): readonly DataSourceDiagnostic[] {
  if (!Array.isArray(value)) throw invalidResponse();
  return value.map((entry) => {
    const record = readRecord(entry);
    if (
      !record ||
      typeof record.code !== 'string' ||
      typeof record.message !== 'string' ||
      !isSeverity(record.severity)
    ) {
      throw invalidResponse();
    }
    return {
      code: record.code,
      message: record.message,
      severity: record.severity,
      apiId: readString(record.apiId),
      endpointId: readString(record.endpointId),
      operationId: readString(record.operationId),
      path: readString(record.path),
      hint: readString(record.hint),
    };
  });
}

/*** Validate and normalize the discovery attempts emitted while resolving an external API. */
function parseAttempts(value: unknown): readonly ExternalApiDiscoveryAttempt[] {
  if (!Array.isArray(value)) throw invalidResponse();
  return value.map((entry) => {
    const record = readRecord(entry);
    if (!record || typeof record.url !== 'string' || typeof record.outcome !== 'string') {
      throw invalidResponse();
    }
    return {
      url: record.url,
      outcome: record.outcome,
      status: typeof record.status === 'number' ? record.status : undefined,
    };
  });
}

/***
 * Parse an optional HTTP request summary from an unknown response payload.
 * @utility @ankhorage/utility/http
 */
function parseRequestSummary(value: unknown) {
  if (value === undefined) return undefined;
  const record = readRecord(value);
  if (
    !record ||
    typeof record.method !== 'string' ||
    typeof record.url !== 'string' ||
    typeof record.dryRun !== 'boolean'
  ) {
    throw invalidResponse();
  }
  return { method: record.method, url: record.url, dryRun: record.dryRun };
}

/***
 * Parse an optional HTTP response status summary from an unknown payload.
 * @utility @ankhorage/utility/http
 */
function parseResponseSummary(value: unknown) {
  if (value === undefined) return undefined;
  const record = readRecord(value);
  if (!record || typeof record.status !== 'number' || typeof record.ok !== 'boolean') {
    throw invalidResponse();
  }
  return { status: record.status, ok: record.ok };
}

/***
 * Return whether a response value is a structured result record explicitly marked unsuccessful.
 * @utility @ankhorage/utility/validation
 */
function isStructuredFailure(value: unknown): boolean {
  return readRecord(value)?.ok === false;
}

/*** Return whether an unknown value is an External API protocol supported by this authoring flow. */
function isConnectedProtocol(value: unknown): value is 'graphql' | 'rest' {
  return value === 'graphql' || value === 'rest';
}

/***
 * Return whether an unknown value is a canonical DataSourceDiagnostic severity.
 * @todo Move this reusable guard beside the contracts/data diagnostic definition.
 */
function isSeverity(value: unknown): value is DataSourceDiagnostic['severity'] {
  return value === 'error' || value === 'info' || value === 'warning';
}

/***
 * Validate recursively that a value belongs to the DataContractValue JSON-like value domain.
 * @todo Move this reusable guard beside DataContractValue in the contracts/data owner.
 */
function isDataContractValue(value: unknown): value is DataContractValue {
  if (value === null || ['boolean', 'number', 'string'].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isDataContractValue);
  const record = readRecord(value);
  return record !== null && Object.values(record).every(isDataContractValue);
}

/***
 * Narrow an unknown value to a strict non-array record or return null.
 * @utility @ankhorage/utility/value
 */
function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/***
 * Narrow an unknown value to a string or return undefined.
 * @utility @ankhorage/utility/value
 */
function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/***
 * Create a bad-gateway-style error for an invalid upstream response.
 * @utility @ankhorage/utility/http
 */
function invalidResponse(): ExternalApiApiError {
  return new ExternalApiApiError('The Studio host returned an invalid external API response.', 502);
}
