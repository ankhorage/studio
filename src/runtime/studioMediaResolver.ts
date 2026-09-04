import type { MediaAsset } from '@ankhorage/contracts';
import type { RuntimeMediaAssetResolver } from '@ankhorage/runtime';

interface ResolvedMediaResponse {
  readonly url?: string;
}

/***
 * Adapt Studio project/API context into the runtime media-asset resolver contract.
 * @todo Move this concrete Studio media HTTP adapter out of generic `runtime/` and beside the media package-edge integration.
 */
export function createStudioMediaAssetResolver(args: {
  readonly apiBase: string;
  readonly projectId: string;
}): RuntimeMediaAssetResolver {
  /*** Resolve one runtime media asset through the configured Studio project media endpoint. */
  return async ({ asset }) => resolveStudioMediaAsset(args, asset);
}

/***
 * Resolve one Studio storage-backed media asset to its current host URL; non-storage assets and unsuccessful responses resolve to null.
 * @todo Keep Studio media source semantics in the media domain while replacing the inline fetch/JSON transport with the canonical HTTP Utility.
 */
async function resolveStudioMediaAsset(
  args: { readonly apiBase: string; readonly projectId: string },
  asset: MediaAsset,
): Promise<string | null> {
  if (asset.source.kind !== 'storage') return null;
  const response = await fetch(
    `${args.apiBase}/projects/${encodeURIComponent(args.projectId)}/media/resolve`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: asset.source }),
    },
  );
  if (!response.ok) return null;
  const payload = (await response.json()) as ResolvedMediaResponse;
  return typeof payload.url === 'string' && payload.url.length > 0 ? payload.url : null;
}
