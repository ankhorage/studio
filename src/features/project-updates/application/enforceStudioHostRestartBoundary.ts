import type { ApmPlanBlocker, ApmPlanResult, ApmPlanStep } from '@ankhorage/apm/types';

const STUDIO_PACKAGE_NAME = '@ankhorage/studio';
const HOST_RESTART_STEP_ID = 'studio-host-restart';

/*** Block execution when a reviewed plan selects a Studio owner artifact different from the running host. */
export function enforceStudioHostRestartBoundary(
  plan: ApmPlanResult,
  runningStudioVersion: string,
): ApmPlanResult {
  const target = plan.targets.find(
    ({ name, targetVersion }) =>
      name === STUDIO_PACKAGE_NAME && targetVersion !== runningStudioVersion,
  );
  if (target === undefined) return plan;

  const blocker = createHostUpgradeBlocker(runningStudioVersion, target.targetVersion);
  const step = createHostRestartStep(runningStudioVersion, target.targetVersion);
  return {
    ...plan,
    complete: false,
    blockers: appendBlocker(plan.blockers, blocker),
    steps: appendRestartStep(plan.steps, step),
  };
}

/*** Describe the explicit restart prerequisite without treating a running executor as replaceable. */
function createHostUpgradeBlocker(
  runningStudioVersion: string,
  targetStudioVersion: string,
): ApmPlanBlocker {
  return {
    code: 'plan.host-upgrade-required',
    scope: { kind: 'host', id: STUDIO_PACKAGE_NAME },
    evidence: [
      `running:${STUDIO_PACKAGE_NAME}@${runningStudioVersion}`,
      `target:${STUDIO_PACKAGE_NAME}@${targetStudioVersion}`,
    ],
    reason: `Running Studio ${runningStudioVersion} cannot execute owner work selected for Studio ${targetStudioVersion}.`,
    nextAction: `Upgrade Studio to ${targetStudioVersion}, restart the host, then inspect and create a fresh plan.`,
  };
}

/*** Represent the restart boundary explicitly in the structured plan shown by Studio. */
function createHostRestartStep(
  runningStudioVersion: string,
  targetStudioVersion: string,
): ApmPlanStep {
  return {
    id: HOST_RESTART_STEP_ID,
    kind: 'host-restart',
    prerequisites: [],
    owner: STUDIO_PACKAGE_NAME,
    reason: `Restart Studio ${runningStudioVersion} with the selected ${targetStudioVersion} owner artifact before applying project changes.`,
    evidence: [
      `running:${STUDIO_PACKAGE_NAME}@${runningStudioVersion}`,
      `required:${STUDIO_PACKAGE_NAME}@${targetStudioVersion}`,
    ],
    execution: {
      kind: 'host-restart',
      hostId: STUDIO_PACKAGE_NAME,
      requiredVersion: targetStudioVersion,
    },
  };
}

/*** Preserve any upstream host blocker while avoiding duplicate presentation rows. */
function appendBlocker(
  blockers: readonly ApmPlanBlocker[],
  blocker: ApmPlanBlocker,
): readonly ApmPlanBlocker[] {
  return blockers.some(({ code }) => code === 'plan.host-upgrade-required')
    ? blockers
    : [...blockers, blocker];
}

/*** Preserve any upstream restart step while avoiding duplicate execution boundaries. */
function appendRestartStep(
  steps: readonly ApmPlanStep[],
  step: ApmPlanStep,
): readonly ApmPlanStep[] {
  return steps.some(({ kind }) => kind === 'host-restart') ? steps : [...steps, step];
}
