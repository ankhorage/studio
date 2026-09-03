import type { ProjectDeployReleaseInspectionResult } from './projectDeployReleaseInspectionResult';

/***
 * Decide whether a prepared Studio deploy release may execute without pending inspection actions.
 * @todo Move deploy execution-gate policy under src/deploy/.
 */
export function canExecuteProjectDeployRelease(
  result: ProjectDeployReleaseInspectionResult,
): boolean {
  return result.ok && result.plan.status === 'changes' && result.inspection.actions.length === 0;
}
