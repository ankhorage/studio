import type { StudioAuthSettings } from './authSettings';
import { validateStudioAuthSettings } from './authSettings';

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

export async function getProjectAuthSettings(
  projectId: string,
): Promise<StudioAuthSettings | null> {
  const value = await requestJson(`/projects/${encodeURIComponent(projectId)}/auth/config`);
  return parseProjectAuthSettingsResponse(value, 'loaded');
}

export async function saveProjectAuthSettings(input: {
  readonly projectId: string;
  readonly config: StudioAuthSettings;
}): Promise<StudioAuthSettings> {
  const value = await requestJson(`/projects/${encodeURIComponent(input.projectId)}/auth/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config: input.config }),
  });
  const result = parseProjectAuthSettingsResponse(value, 'saved');
  if (!result) {
    throw new ProjectAuthApiError({
      code: 'invalid_response',
      message: 'Saved auth configuration response did not contain configuration data.',
      status: 502,
    });
  }
  return result;
}

export function parseProjectAuthSettingsResponse(
  value: unknown,
  expectedState: 'loaded' | 'saved',
): StudioAuthSettings | null {
  const record = asRecord(value);
  if (record?.ok !== true || record.state !== expectedState) {
    throw invalidResponse('Project auth response was invalid.');
  }
  if (record.data === null && expectedState === 'loaded') return null;

  const parsed = validateStudioAuthSettings(record.data);
  if (!parsed.ok) throw invalidResponse(parsed.error.message);
  return parsed.data;
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
