import type { AppManifest } from '@ankhorage/contracts';
import type { AppEnvironmentId } from '@ankhorage/contracts/environments';
import type { InfraEnvironmentSpec } from '@ankhorage/contracts/infra';

/*** Resolve one explicitly selected infrastructure environment from a canonical app manifest. */
export function resolveProjectInfraEnvironment(
  manifest: AppManifest,
  environment: AppEnvironmentId = 'local',
): InfraEnvironmentSpec {
  const resolved = manifest.infra.environments[environment];
  if (!resolved) {
    throw new Error(
      `Project '${manifest.metadata.slug}' does not configure infrastructure environment '${environment}'.`,
    );
  }
  return resolved;
}
