import type { AppManifest } from '@ankhorage/contracts';
import type { AppEnvironmentId } from '@ankhorage/contracts/environments';
import type { InfraEnvironmentSpec } from '@ankhorage/contracts/infra';

import { resolveProjectInfraEnvironment } from './resolveProjectInfraEnvironment';

/*** Replace one canonical infrastructure environment while preserving every other manifest slice. */
export function updateProjectInfraEnvironment(
  manifest: AppManifest,
  update: (environment: InfraEnvironmentSpec) => InfraEnvironmentSpec,
  environment: AppEnvironmentId = 'local',
): AppManifest {
  const current = resolveProjectInfraEnvironment(manifest, environment);
  return {
    ...manifest,
    infra: {
      ...manifest.infra,
      environments: {
        ...manifest.infra.environments,
        [environment]: update(current),
      },
    },
  };
}
