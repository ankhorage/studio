import type { MediaAsset, MediaAssetSource } from '@ankhorage/contracts';

import type {
  StudioMediaIngestResult,
  StudioMediaIngestTarget,
  StudioMediaPickerSelection,
} from '../mediaPickerAuthoring';
import { API_BASE } from './constants';
import type { StudioMediaSourceCleanupResult } from './mediaRemovalCoordinator';

interface IngestStudioMediaSelectionArgs {
  readonly projectId: string;
  readonly assetId: string;
  readonly selection: StudioMediaPickerSelection;
  readonly target?: StudioMediaIngestTarget;
}

/***
 * Send a picked media payload to the Studio host and return the persisted media asset.
 * @todo Move this concrete HTTP adapter from core/ beside the media domain boundary.
 */
export async function ingestStudioMediaSelection(
  args: IngestStudioMediaSelectionArgs,
): Promise<StudioMediaIngestResult> {
  const query = createIngestQuery(args.assetId, args.selection);
  const endpoint = args.target === 'bundled' ? 'bundle' : 'ingest';
  const response = await fetch(
    `${API_BASE}/projects/${encodeURIComponent(args.projectId)}/media/${endpoint}?${query}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: Uint8Array.from(args.selection.body).buffer,
    },
  );
  const payload = (await response.json()) as { asset?: MediaAsset; error?: string };
  if (!response.ok || !payload.asset) {
    return { ok: false, reason: payload.error ?? `Media ingest failed (${response.status}).` };
  }
  return { ok: true, asset: payload.asset };
}

/***
 * Request deletion of a Studio-owned media source while treating external URLs as non-owned.
 * @todo Move this concrete HTTP adapter from core/ beside the media domain boundary.
 */
export async function cleanupStudioMediaSource(
  projectId: string,
  source: MediaAssetSource,
): Promise<StudioMediaSourceCleanupResult> {
  if (source.kind === 'url') return { ok: true, cleanup: 'none' };
  const response = await fetch(
    `${API_BASE}/projects/${encodeURIComponent(projectId)}/media/cleanup`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source }),
    },
  );
  const payload = (await response.json()) as { cleanup?: 'removed'; error?: string };
  if (!response.ok) {
    return { ok: false, reason: payload.error ?? `Media cleanup failed (${response.status}).` };
  }
  return { ok: true, cleanup: payload.cleanup ?? 'removed' };
}

/***
 * Serialize media ingest metadata into the query string expected by the Studio host endpoint.
 * @todo Keep this protocol-specific serializer with the media HTTP adapter.
 */
function createIngestQuery(assetId: string, selection: StudioMediaPickerSelection): string {
  const query = new URLSearchParams({ assetId, name: selection.name, kind: selection.kind });
  appendQuery(query, 'contentType', selection.contentType);
  appendQuery(query, 'sizeBytes', selection.sizeBytes);
  appendQuery(query, 'width', selection.width);
  appendQuery(query, 'height', selection.height);
  appendQuery(query, 'durationMs', selection.durationMs);
  return query.toString();
}

/***
 * Append an optional scalar value to a URL query when the value is present.
 * @todo Keep this small helper local to the media HTTP adapter until cross-repository reuse is demonstrated.
 */
function appendQuery(query: URLSearchParams, key: string, value: number | string | undefined) {
  if (value !== undefined) query.set(key, String(value));
}
