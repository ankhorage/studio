import type {
  ApmApplyPermissions,
  ApmPlanPolicyInput,
  ApmStatusAvailabilityMode,
} from '@ankhorage/apm/types';

export interface ProjectUpdateHostPlanInput {
  readonly availability: ApmStatusAvailabilityMode;
  readonly policy: ApmPlanPolicyInput;
}

export interface ProjectUpdateHostPort {
  readonly statusAsync: (
    projectId: string,
    availability: ApmStatusAvailabilityMode,
  ) => Promise<unknown>;
  readonly planAsync: (projectId: string, input: ProjectUpdateHostPlanInput) => Promise<unknown>;
  readonly applyAsync: (
    projectId: string,
    plan: unknown,
    permissions: ApmApplyPermissions,
  ) => Promise<unknown>;
  readonly resumeAsync: (
    projectId: string,
    operationId: string,
    permissions: ApmApplyPermissions,
  ) => Promise<unknown>;
  readonly verifyAsync: (projectId: string, operationId: string) => Promise<unknown>;
}
