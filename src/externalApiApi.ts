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

/**
 * @question why ApiApi (duplication of 'Api')?
 */
class ExternalApiApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ExternalApiApiError';
    this.status = status;
  }
}

export function connectExternalApi(
  projectId: string,
  request: ExternalApiConnectRequest,
): Promise<ExternalApiConnectResult> {
  return requestResult(projectId, 'connect', request, parseConnectResult);
}

export function createManualRestApi(
  projectId: string,
  request: ManualRestApiRequest,
): Promise<ExternalApiConnectResult> {
  return requestResult(projectId, 'manual-rest', request, parseConnectResult);
}

export function testExternalApiOperation(
  projectId: string,
  request: ExternalApiOperationTestRequest,
): Promise<ExternalApiOperationTestResult> {
  return requestResult(projectId, 'test', request, parseTestResult);
}

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

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ExternalApiApiError('The Studio host returned a non-JSON response.', response.status);
  }
}

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

function requireResultRecord(value: unknown): Record<string, unknown> & { readonly ok: boolean } {
  const record = readRecord(value);
  if (!record || typeof record.ok !== 'boolean') throw invalidResponse();
  return { ...record, ok: record.ok };
}

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

function parseResponseSummary(value: unknown) {
  if (value === undefined) return undefined;
  const record = readRecord(value);
  if (!record || typeof record.status !== 'number' || typeof record.ok !== 'boolean') {
    throw invalidResponse();
  }
  return { status: record.status, ok: record.ok };
}

function isStructuredFailure(value: unknown): boolean {
  return readRecord(value)?.ok === false;
}

function isConnectedProtocol(value: unknown): value is 'graphql' | 'rest' {
  return value === 'graphql' || value === 'rest';
}

function isSeverity(value: unknown): value is DataSourceDiagnostic['severity'] {
  return value === 'error' || value === 'info' || value === 'warning';
}

function isDataContractValue(value: unknown): value is DataContractValue {
  if (value === null || ['boolean', 'number', 'string'].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isDataContractValue);
  const record = readRecord(value);
  return record !== null && Object.values(record).every(isDataContractValue);
}

/***
 * @owner ankhorage/utility/{category}
 * @question why is the return null instead of undefined?
 */
function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/***
 * @owner ankhorage/utility/{category}
 */
function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function invalidResponse(): ExternalApiApiError {
  return new ExternalApiApiError('The Studio host returned an invalid external API response.', 502);
}
