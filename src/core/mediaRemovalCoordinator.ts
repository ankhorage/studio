import type { AppManifest, MediaAssetSource } from '@ankhorage/contracts';

import { removeStudioMediaAsset, type StudioMediaDeleteResult } from '../mediaAuthoringModel';

export interface StudioMediaSourceCleanupResult {
  readonly ok: boolean;
  readonly cleanup?: 'none' | 'removed';
  readonly reason?: string;
}

/***
 * Persist removal of a media asset before cleaning up its owned source, restoring the manifest when persistence fails.
 * @todo Move this media application orchestration from core/ into the media domain.
 */
export async function commitStudioMediaRemoval(args: {
  readonly manifest: AppManifest;
  readonly mediaId: string;
  readonly applyManifest: (manifest: AppManifest) => void;
  readonly persistManifest: () => Promise<void>;
  readonly cleanupSource: (source: MediaAssetSource) => Promise<StudioMediaSourceCleanupResult>;
}): Promise<StudioMediaDeleteResult> {
  const asset = args.manifest.media?.assets[args.mediaId];
  const removal = removeStudioMediaAsset(args.manifest, args.mediaId);
  if (!removal.ok) return removal;
  if (!asset) return { ok: false, reason: 'not-found', usages: [] };

  args.applyManifest(removal.manifest);
  try {
    await args.persistManifest();
  } catch (error) {
    args.applyManifest(args.manifest);
    return { ok: false, reason: 'save-failed', message: toMessage(error), mediaRemoved: false };
  }

  try {
    const cleanup = await args.cleanupSource(asset.source);
    if (cleanup.ok) return { ok: true, cleanup: cleanup.cleanup ?? 'none' };
    return cleanupFailure(cleanup.reason ?? 'Media source cleanup failed.');
  } catch (error) {
    return cleanupFailure(toMessage(error));
  }
}

/***
 * Create the delete result used when source cleanup fails after the manifest has already been persisted.
 * @todo Move with the media removal application responsibility.
 */
function cleanupFailure(message: string): StudioMediaDeleteResult {
  return { ok: false, reason: 'cleanup-failed', message, mediaRemoved: true };
}

/***
 * Convert an unknown thrown value into a stable error message.
 * @utility @ankhorage/utility/error
 */
function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
