import type { ProjectDeployReleaseInspectionResult } from './projectDeployReleaseInspectionResult';

export function canExecuteProjectDeployRelease(
  result: ProjectDeployReleaseInspectionResult,
): boolean {
  return result.ok && result.plan.status === 'changes' && result.inspection.actions.length === 0;
}
