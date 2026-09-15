import type { ProjectUpdateServiceOptions } from '../../../types/project-updates';
import { ProjectUpdateService } from '../application/ProjectUpdateService';
import { createStudioProjectUpdateExtensionEvidencePort } from './createStudioProjectUpdateExtensionEvidencePort';
import { createStudioProjectUpdateProtocolPort } from './createStudioProjectUpdateProtocolPort';

/*** Compose Studio-owned status and planning evidence around the released APM lifecycle service. */
export function createStudioProjectUpdateService(
  options: ProjectUpdateServiceOptions = {},
): ProjectUpdateService {
  return new ProjectUpdateService({
    ...options,
    extensions: createStudioProjectUpdateExtensionEvidencePort(options.extensions),
    protocol: createStudioProjectUpdateProtocolPort(options.protocol),
  });
}
