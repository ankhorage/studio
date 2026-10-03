import type { ProjectUpdateServiceOptions } from '../../../types/project-updates';
import { getGeneratedPackagePolicy } from '../adapters/outbound/getGeneratedPackagePolicy';
import { ProjectUpdateService } from '../application/ProjectUpdateService';
import type { StudioPendingModuleLifecyclePort } from '../application/StudioPendingModuleLifecyclePort';
import { createStudioGeneratedPackagePolicyUpdatePorts } from './createStudioGeneratedPackagePolicyUpdatePorts';
import { createStudioProjectUpdateApplyOwnerStepPort } from './createStudioProjectUpdateApplyOwnerStepPort';
import { createStudioProjectUpdateExtensionEvidencePort } from './createStudioProjectUpdateExtensionEvidencePort';
import { createStudioProjectUpdateProtocolPort } from './createStudioProjectUpdateProtocolPort';
import { createStudioProjectUpdateVerifyOwnerStepPort } from './createStudioProjectUpdateVerifyOwnerStepPort';

/*** Compose Studio-owned APM evidence, planning, execution, and verification around one host lifecycle port. */
export function createStudioProjectUpdateService(
  options: ProjectUpdateServiceOptions = {},
  lifecycle?: StudioPendingModuleLifecyclePort,
): ProjectUpdateService {
  const runningStudioVersion = getGeneratedPackagePolicy().ownerVersion;
  const packagePolicy = createStudioGeneratedPackagePolicyUpdatePorts(options);
  return new ProjectUpdateService(
    {
      ...packagePolicy,
      extensions: createStudioProjectUpdateExtensionEvidencePort(packagePolicy.extensions),
      protocol: createStudioProjectUpdateProtocolPort(packagePolicy.protocol, {
        pendingLifecycleExecution: lifecycle !== undefined,
      }),
      applyOwnerStep:
        lifecycle === undefined
          ? packagePolicy.applyOwnerStep
          : createStudioProjectUpdateApplyOwnerStepPort(lifecycle, packagePolicy.applyOwnerStep),
      verifyOwnerStep:
        lifecycle === undefined
          ? packagePolicy.verifyOwnerStep
          : createStudioProjectUpdateVerifyOwnerStepPort(lifecycle, packagePolicy.verifyOwnerStep),
    },
    runningStudioVersion,
  );
}
