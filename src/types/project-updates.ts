import type {
  ApmApplyCancellationPort,
  ApmApplyProgressPort,
  ApmApplyStepPort,
  ApmPlanProtocolPort,
  ApmStatusExtensionEvidencePort,
  ApmVerifyStepPort,
} from '@ankhorage/apm/types';

/*** Optional Studio-owned ports composed around the released APM project update lifecycle. */
export interface ProjectUpdateServiceOptions {
  readonly extensions?: ApmStatusExtensionEvidencePort;
  readonly protocol?: ApmPlanProtocolPort;
  readonly applyOwnerStep?: ApmApplyStepPort;
  readonly verifyOwnerStep?: ApmVerifyStepPort;
  readonly progress?: ApmApplyProgressPort;
  readonly cancellation?: ApmApplyCancellationPort;
}
