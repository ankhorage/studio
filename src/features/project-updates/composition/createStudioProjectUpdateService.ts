import type { ProjectUpdateServiceOptions } from '../../../types/project-updates';
import { getGeneratedPackagePolicy } from '../adapters/outbound/getGeneratedPackagePolicy';
import { ProjectUpdateService } from '../application/ProjectUpdateService';
import type { StudioPendingModuleLifecyclePort } from '../application/StudioPendingModuleLifecyclePort';
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
  return new ProjectUpdateService(
    {
      ...options,
      extensions: createStudioProjectUpdateExtensionEvidencePort(options.extensions),
      protocol: createStudioProjectUpdateProtocolPort(options.protocol, {
        pendingLifecycleExecution: lifecycle !== undefined,
      }),
      ...(lifecycle === undefined
        ? {}
        : {
            applyOwnerStep: createStudioProjectUpdateApplyOwnerStepPort(
              lifecycle,
              options.applyOwnerStep,
            ),
            verifyOwnerStep: createStudioProjectUpdateVerifyOwnerStepPort(
              lifecycle,
              options.verifyOwnerStep,
            ),
          }),
    },
    runningStudioVersion,
  );
}
