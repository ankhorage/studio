import type { AppManifest } from '@ankhorage/contracts';

/*** Determine whether the global-auth system template applies to a manifest. */
export function supportsGlobalAuthSystemTemplate(manifest: AppManifest): boolean {
  return manifest.infra.environments.local.auth?.scope === 'global';
}

/*** Apply the current global-auth system template, which is presently an identity transformation. */
export function applyGlobalAuthSystemTemplate(manifest: AppManifest): AppManifest {
  return manifest;
}
