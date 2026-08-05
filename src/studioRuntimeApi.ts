import type { AppManifest } from '@ankhorage/contracts';

export async function syncStudioRuntime(projectId: string, apiBase?: string): Promise<void> {
  const resolvedApiBase = apiBase ?? (await import('./core/constants')).API_BASE;
  const encodedProjectId = encodeURIComponent(projectId);
  const manifestResponse = await fetch(
    `${resolvedApiBase}/projects/${encodedProjectId}/studio/manifest`,
  );
  const manifest = await readJson(manifestResponse, 'Studio manifest');
  if (!manifestResponse.ok) {
    throw new Error(readErrorMessage(manifest, 'Unable to load the Studio manifest.'));
  }

  const runtimeResponse = await fetch(
    `${resolvedApiBase}/projects/${encodedProjectId}/studio/runtime`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(manifest as AppManifest),
    },
  );
  const runtimeResult = await readJson(runtimeResponse, 'Studio runtime sync');
  if (!runtimeResponse.ok) {
    throw new Error(readErrorMessage(runtimeResult, 'Unable to apply the Studio runtime.'));
  }
}

async function readJson(response: Response, label: string): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error(`${label} returned non-JSON status ${response.status}.`);
  }
}

function readErrorMessage(value: unknown, fallback: string): string {
  if (typeof value !== 'object' || value === null) return fallback;
  const error = (value as Record<string, unknown>).error;
  if (typeof error === 'string' && error.trim().length > 0) return error;
  if (typeof error !== 'object' || error === null) return fallback;
  const message = (error as Record<string, unknown>).message;
  return typeof message === 'string' && message.trim().length > 0 ? message : fallback;
}
