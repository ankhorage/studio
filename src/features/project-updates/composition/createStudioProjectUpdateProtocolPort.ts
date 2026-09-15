import type {
  ApmExtensionObservation,
  ApmPlanBlocker,
  ApmPlanProtocolPort,
  ApmPlanProtocolResult,
} from '@ankhorage/apm/types';

import {
  STUDIO_PENDING_MODULE_LIFECYCLE_EVIDENCE,
  STUDIO_PENDING_MODULE_LIFECYCLE_PROJECTION_ID,
} from '../constants';

/*** Extend package-owner planning with explicit pending Studio module-lifecycle blockers. */
export function createStudioProjectUpdateProtocolPort(
  base?: ApmPlanProtocolPort,
): ApmPlanProtocolPort {
  return {
    planProtocolAsync: async (input) => {
      const baseResult = await readBaseProtocolResultAsync(base, input);
      const pending = input.status.extensions.observations.find(
        isPendingModuleLifecycleObservation,
      );
      const unhandled =
        base === undefined
          ? input.status.extensions.observations.filter(
              (observation) =>
                !isPendingModuleLifecycleObservation(observation) &&
                requiresProtocolPlanning(observation, input.policy.repairProjections),
            )
          : [];
      const additionalBlockers = [
        ...(pending === undefined ? [] : [pendingLifecycleBlocker(pending)]),
        ...(unhandled.length === 0 ? [] : [protocolUnavailableBlocker(unhandled)]),
      ];
      return {
        ...baseResult,
        complete: baseResult.complete && additionalBlockers.length === 0,
        blockers: [...baseResult.blockers, ...additionalBlockers],
      };
    },
  };
}

const EMPTY_PROTOCOL_RESULT: ApmPlanProtocolResult = {
  complete: true,
  requiredSelections: [],
  files: [],
  artifacts: [],
  steps: [],
  effects: [],
  findings: [],
  blockers: [],
  diagnostics: [],
};

/*** Delegate existing package-owner planning when present instead of replacing it. */
async function readBaseProtocolResultAsync(
  base: ApmPlanProtocolPort | undefined,
  input: Parameters<ApmPlanProtocolPort['planProtocolAsync']>[0],
): Promise<ApmPlanProtocolResult> {
  return base === undefined ? EMPTY_PROTOCOL_RESULT : base.planProtocolAsync(input);
}

/*** Identify the Studio-owned pending module lifecycle observation by stable evidence. */
function isPendingModuleLifecycleObservation(observation: ApmExtensionObservation): boolean {
  return observation.evidence.includes(STUDIO_PENDING_MODULE_LIFECYCLE_EVIDENCE);
}

/*** Mirror APM's owner-planning requirement for evidence not handled by Studio's local blocker. */
function requiresProtocolPlanning(
  observation: ApmExtensionObservation,
  repairProjections: boolean,
): boolean {
  return (
    observation.migration === 'pending' || (repairProjections && observation.projection === 'stale')
  );
}

/*** Block apply until queued removals have a reviewed owner execution boundary. */
function pendingLifecycleBlocker(observation: ApmExtensionObservation): ApmPlanBlocker {
  return {
    code: 'protocol.studio-pending-module-lifecycle',
    scope: { kind: 'projection', id: STUDIO_PENDING_MODULE_LIFECYCLE_PROJECTION_ID },
    evidence: observation.evidence,
    reason:
      'Studio module removals are queued, but no reviewed APM owner execution step exists for their Orchestrator lifecycle effects yet.',
    nextAction:
      'Review or finalize the pending module lifecycle through its explicit owner flow before applying the project update plan.',
  };
}

/*** Preserve APM's fail-closed behavior when another owner observation lacks a planner. */
function protocolUnavailableBlocker(
  observations: readonly ApmExtensionObservation[],
): ApmPlanBlocker {
  return {
    code: 'plan.protocol-unavailable',
    scope: { kind: 'project' },
    evidence: observations.flatMap((observation) => observation.evidence),
    reason: 'Package-owned migration or projection work is pending without a composed planner.',
    nextAction: 'Compose the required trusted owner planner before applying project updates.',
  };
}
