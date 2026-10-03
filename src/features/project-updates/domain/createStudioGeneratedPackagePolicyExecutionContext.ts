import type {
  ApmExtensionArtifactIdentity,
  ApmExtensionExecutionContext,
} from '@ankhorage/apm/types';

import { STUDIO_PACKAGE_NAME } from '../constants';

/*** Build immutable Studio owner execution context for one source app and target artifact. */
export function createStudioGeneratedPackagePolicyExecutionContext(
  sourceVersion: string,
  artifact: ApmExtensionArtifactIdentity,
): ApmExtensionExecutionContext {
  return {
    owner: STUDIO_PACKAGE_NAME,
    sourceVersion,
    targetVersion: artifact.version,
    artifact,
  };
}
