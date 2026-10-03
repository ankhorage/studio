import type { ProjectUpdateServiceOptions } from '../../../types/project-updates';
import { resolveCurrentStudioApmArtifactAsync } from '../adapters/outbound/resolveCurrentStudioApmArtifactAsync';
import { createStudioGeneratedPackagePolicyApplyOwnerStepPort } from './createStudioGeneratedPackagePolicyApplyOwnerStepPort';
import { createStudioGeneratedPackagePolicyExtensionEvidencePort } from './createStudioGeneratedPackagePolicyExtensionEvidencePort';
import { createStudioGeneratedPackagePolicyProtocolPort } from './createStudioGeneratedPackagePolicyProtocolPort';
import { createStudioGeneratedPackagePolicyVerifyOwnerStepPort } from './createStudioGeneratedPackagePolicyVerifyOwnerStepPort';

interface GeneratedPackagePolicyUpdateOptions {
  readonly resolveArtifactAsync?: typeof resolveCurrentStudioApmArtifactAsync;
}

/*** Compose Studio's generated-package owner projection into the ordinary APM lifecycle. */
export function createStudioGeneratedPackagePolicyUpdatePorts(
  base: ProjectUpdateServiceOptions = {},
  options: GeneratedPackagePolicyUpdateOptions = {},
): ProjectUpdateServiceOptions {
  const resolveArtifactAsync = options.resolveArtifactAsync ?? resolveCurrentStudioApmArtifactAsync;
  return {
    ...base,
    extensions: createStudioGeneratedPackagePolicyExtensionEvidencePort(
      base.extensions,
      resolveArtifactAsync,
    ),
    protocol: createStudioGeneratedPackagePolicyProtocolPort(base.protocol, resolveArtifactAsync),
    applyOwnerStep: createStudioGeneratedPackagePolicyApplyOwnerStepPort(base.applyOwnerStep),
    verifyOwnerStep: createStudioGeneratedPackagePolicyVerifyOwnerStepPort(base.verifyOwnerStep),
  };
}
