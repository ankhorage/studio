import type { MediaAsset } from '@ankhorage/contracts';
import type { RuntimeMediaAssetResolver } from '@ankhorage/runtime';

interface ResolvedMediaResponse {
  readonly url?: string;
}

export function createStudioMediaAssetResolver(args: {
  readonly apiBase: string;
  readonly projectId: string;
}): RuntimeMediaAssetResolver {
  return async ({ asset }) => resolveStudioMediaAsset(args, asset);
}

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
