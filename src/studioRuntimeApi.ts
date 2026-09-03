/***
 * Ask the Studio host to synchronize one project's runtime state.
 * @todo Move concrete runtime-sync HTTP access behind the owning runtime/application edge instead of a direct src/ API file.
 */
export async function syncProjectRuntime(projectId: string, apiBase?: string): Promise<void> {
  const resolvedApiBase = apiBase ?? (await import('./core/constants')).API_BASE;
  const encodedProjectId = encodeURIComponent(projectId);
  const response = await fetch(`${resolvedApiBase}/projects/${encodedProjectId}/runtime/sync`, {
    method: 'POST',
  });
  const result = await readJson(response, 'Project runtime sync');
  if (!response.ok) {
    throw new Error(readErrorMessage(result, 'Unable to sync the project runtime.'));
  }
}

/***
 * Decode an HTTP response as JSON and throw a labeled error for a non-JSON body.
 * @utility @ankhorage/utility/http
 */
async function readJson(response: Response, label: string): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error(`${label} returned non-JSON status ${response.status}.`);
  }
}

/***
 * Read a non-empty error string or nested error message from an unknown response payload.
 * @utility @ankhorage/utility/http
 */
function readErrorMessage(value: unknown, fallback: string): string {
  if (typeof value !== 'object' || value === null) return fallback;
  const { error } = value as Record<string, unknown>;
  if (typeof error === 'string' && error.trim().length > 0) return error;
  if (typeof error !== 'object' || error === null) return fallback;
  const { message } = error as Record<string, unknown>;
  return typeof message === 'string' && message.trim().length > 0 ? message : fallback;
}
