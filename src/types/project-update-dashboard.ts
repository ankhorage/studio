import type { ApmApplyPermissions, ApmStatusAvailabilityMode } from '@ankhorage/apm/types';

export type ProjectUpdatePermissionId = 'owner-code' | 'lifecycle-scripts' | 'external-effects';

export interface ProjectUpdateDashboardState {
  readonly projectId: string;
  readonly availability: ApmStatusAvailabilityMode;
  readonly status: unknown;
  readonly plan: unknown;
  readonly execution: unknown;
  readonly verification: unknown;
  readonly operationId: string;
  readonly permissions: ApmApplyPermissions;
  readonly busy: 'status' | 'plan' | 'apply' | 'resume' | 'verify' | null;
  readonly error: string | null;
}

export type ProjectUpdateDashboardEvent =
  | { readonly type: 'project-changed'; readonly projectId: string }
  | { readonly type: 'availability-changed'; readonly availability: ApmStatusAvailabilityMode }
  | {
      readonly type: 'request-started';
      readonly action: 'status' | 'plan' | 'apply' | 'resume' | 'verify';
    }
  | { readonly type: 'request-failed'; readonly message: string }
  | { readonly type: 'status-received'; readonly status: unknown }
  | { readonly type: 'plan-received'; readonly plan: unknown }
  | {
      readonly type: 'permissions-changed';
      readonly permissions: ApmApplyPermissions;
    }
  | {
      readonly type: 'execution-received';
      readonly execution: unknown;
      readonly operationId?: string;
    }
  | { readonly type: 'verification-received'; readonly verification: unknown }
  | { readonly type: 'operation-id-changed'; readonly operationId: string };
