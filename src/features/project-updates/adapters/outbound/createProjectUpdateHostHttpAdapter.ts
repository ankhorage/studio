import { isRecord } from '@ankhorage/utility/object';

import type { ProjectUpdateHostPort } from '../../application/ports/outbound/ProjectUpdateHostPort';

/*** Create the browser-safe outbound adapter for Studio's project-scoped APM host routes. */
export function createProjectUpdateHostHttpAdapter(apiBase: string): ProjectUpdateHostPort {
  return {
    statusAsync: async (projectId, availability) =>
      requestJsonAsync(
        apiBase,
        `/projects/${encodeURIComponent(projectId)}/updates/status?availability=${encodeURIComponent(availability)}`,
        { method: 'GET' },
      ),
    planAsync: async (projectId, input) =>
      requestJsonAsync(apiBase, `/projects/${encodeURIComponent(projectId)}/updates/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    applyAsync: async (projectId, plan, permissions) =>
      requestJsonAsync(apiBase, `/projects/${encodeURIComponent(projectId)}/updates/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, permissions }),
      }),
    resumeAsync: async (projectId, operationId, permissions) =>
      requestJsonAsync(apiBase, `/projects/${encodeURIComponent(projectId)}/updates/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationId, permissions }),
      }),
    verifyAsync: async (projectId, operationId) =>
      requestJsonAsync(apiBase, `/projects/${encodeURIComponent(projectId)}/updates/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationId }),
      }),
  };
}

/*** Execute one bounded Studio host request and preserve structured APM results as untrusted JSON. */
async function requestJsonAsync(
  apiBase: string,
  path: string,
  init: RequestInit,
): Promise<unknown> {
  const response = await fetch(`${apiBase}${path}`, init);
  const body = await readResponseJsonAsync(response);
  if (response.ok || isStructuredLifecycleConflict(response.status, body)) return body;
  throw new Error(
    readFailureMessage(body) ?? `Project update request failed with ${response.status}.`,
  );
}

/*** Read a response body without turning an invalid error payload into a second exception. */
async function readResponseJsonAsync(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/*** Read the bounded host error message without echoing arbitrary response values. */
function readFailureMessage(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.error === 'string') return value.error;
  return typeof value.message === 'string' ? value.message : undefined;
}

/*** Preserve reviewable APM lifecycle conflicts while rejecting unrelated HTTP 409 payloads. */
function isStructuredLifecycleConflict(status: number, value: unknown): boolean {
  if (status !== 409 || !isRecord(value)) return false;
  return value.operation === 'plan' || value.operation === 'apply' || value.operation === 'verify';
}
