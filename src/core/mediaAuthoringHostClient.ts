import type { MediaAsset } from '@ankhorage/contracts';

import type { StudioMediaIngestResult, StudioMediaPickerSelection } from '../mediaPickerAuthoring';
import { API_BASE } from './constants';

interface IngestStudioMediaSelectionArgs {
  readonly projectId: string;
  readonly assetId: string;
  readonly selection: StudioMediaPickerSelection;
}

export async function ingestStudioMediaSelection(
  args: IngestStudioMediaSelectionArgs,
): Promise<StudioMediaIngestResult> {
  const query = createIngestQuery(args.assetId, args.selection);
  const response = await fetch(
    `${API_BASE}/projects/${encodeURIComponent(args.projectId)}/media/ingest?${query}`,
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

function createIngestQuery(assetId: string, selection: StudioMediaPickerSelection): string {
  const query = new URLSearchParams({ assetId, name: selection.name, kind: selection.kind });
  appendQuery(query, 'contentType', selection.contentType);
  appendQuery(query, 'sizeBytes', selection.sizeBytes);
  appendQuery(query, 'width', selection.width);
  appendQuery(query, 'height', selection.height);
  appendQuery(query, 'durationMs', selection.durationMs);
  return query.toString();
}

function appendQuery(query: URLSearchParams, key: string, value: number | string | undefined) {
  if (value !== undefined) query.set(key, String(value));
}
