import type {
  ProjectUpdateDashboardEvent,
  ProjectUpdateDashboardState,
} from '../../../types/project-update-dashboard';
import { createProjectUpdateDashboardState } from './createProjectUpdateDashboardState';

/*** Reduce Dashboard APM lifecycle events while invalidating reviewed plans on fresh evidence. */
export function reduceProjectUpdateDashboardState(
  state: ProjectUpdateDashboardState,
  event: ProjectUpdateDashboardEvent,
): ProjectUpdateDashboardState {
  switch (event.type) {
    case 'project-changed':
      return createProjectUpdateDashboardState(event.projectId);
    case 'availability-changed':
      return {
        ...state,
        availability: event.availability,
        status: null,
        plan: null,
        error: null,
      };
    case 'request-started':
      return {
        ...state,
        busy: event.action,
        error: null,
        ...(event.action === 'status' || event.action === 'plan' ? { plan: null } : {}),
      };
    case 'request-failed':
      return { ...state, busy: null, error: event.message };
    case 'status-received':
      return { ...state, status: event.status, plan: null, busy: null, error: null };
    case 'plan-received':
      return {
        ...state,
        plan: event.plan,
        execution: null,
        verification: null,
        busy: null,
        error: null,
      };
    case 'permissions-changed':
      return { ...state, permissions: event.permissions };
    case 'execution-received':
      return {
        ...state,
        plan: null,
        execution: event.execution,
        verification: null,
        operationId: event.operationId ?? state.operationId,
        busy: null,
        error: null,
      };
    case 'verification-received':
      return { ...state, verification: event.verification, busy: null, error: null };
    case 'operation-id-changed':
      return { ...state, operationId: event.operationId, verification: null };
  }
}
