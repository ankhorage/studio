import type { ProjectUpdateDashboardState } from '../../../types/project-update-dashboard';

/*** Create isolated Dashboard APM lifecycle state for one selected Studio project. */
export function createProjectUpdateDashboardState(projectId: string): ProjectUpdateDashboardState {
  return {
    projectId,
    availability: 'refresh',
    status: null,
    plan: null,
    execution: null,
    verification: null,
    operationId: '',
    permissions: {
      ownerCode: false,
      lifecycleScripts: false,
      externalEffects: false,
    },
    busy: null,
    error: null,
  };
}
