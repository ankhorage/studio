import type { AppManifest } from '@ankhorage/contracts';

export function supportsGlobalAuthSystemTemplate(manifest: AppManifest): boolean {
  return manifest.infra.auth?.scope === 'global';
}

export function applyGlobalAuthSystemTemplate(manifest: AppManifest): AppManifest {
  return manifest;
}
