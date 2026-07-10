import type { AppManifest } from '@ankhorage/contracts';

export interface ManifestSystemTemplate {
  id: string;
  description?: string;
  applies: (manifest: AppManifest) => boolean;
  apply: (manifest: AppManifest) => AppManifest;
}
