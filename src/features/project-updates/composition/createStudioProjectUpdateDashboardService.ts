import { API_BASE } from '../../../core/constants';
import { createProjectUpdateHostHttpAdapter } from '../adapters/outbound/createProjectUpdateHostHttpAdapter';
import { ProjectUpdateDashboardService } from '../application/ProjectUpdateDashboardService';

/*** Compose Dashboard APM lifecycle orchestration with Studio's authorized HTTP host adapter. */
export function createStudioProjectUpdateDashboardService(): ProjectUpdateDashboardService {
  return new ProjectUpdateDashboardService(createProjectUpdateHostHttpAdapter(API_BASE));
}
