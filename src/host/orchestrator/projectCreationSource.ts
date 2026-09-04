import type { AppManifest, MediaAssetKind } from '@ankhorage/contracts';

export interface ProjectCreationAsset {
  readonly assetId: string;
  readonly name: string;
  readonly fileName?: string;
  readonly kind: MediaAssetKind;
  readonly body: Uint8Array;
  readonly contentType?: string;
  readonly sizeBytes?: number;
  readonly width?: number;
  readonly height?: number;
  readonly durationMs?: number;
}

export interface ProjectCreationSource {
  readonly manifest: AppManifest;
  readonly assets: readonly ProjectCreationAsset[];
}
