import type {
  ApmExtensionArtifactIdentityResolution,
  ApmExtensionObservation,
  ApmPlanBlocker,
  ApmPlanProtocolPort,
  ApmPlanProtocolResult,
} from '@ankhorage/apm/types';

import { resolveCurrentStudioApmArtifactAsync } from '../adapters/outbound/resolveCurrentStudioApmArtifactAsync';
import { planPendingModuleLifecycleAsync } from '../application/planPendingModuleLifecycleAsync';
import {
  STUDIO_PENDING_MODULE_LIFECYCLE_EVIDENCE,
  STUDIO_PENDING_MODULE_LIFECYCLE_PROJECTION_ID,
} from '../constants';

interface StudioProjectUpdateProtocolOptions {
  readonly pendingLifecycleExecution?: boolean;
  readonly resolveArtifactAsync?: (
    rootPath: string,
  ) => Promise<ApmExtensionArtifactIdentityResolution>;
  readonly nowIso?: () => string;
}

/*** Extend package-owner planning with reviewed Studio pending-module lifecycle execution. */
export function createStudioProjectUpdateProtocolPort(
  base?: ApmPlanProtocolPort,
  options: StudioProjectUpdateProtocolOptions = {},
): ApmPlanProtocolPort {
  return {
    planProtocolAsync: async (input) => {
      const baseResult = await readBaseProtocolResultAsync(base, input);
      const pending = input.status.extensions.observations.find(
        isPendingModuleLifecycleObservation,
      );
      const pendingSlice = await planPendingObservationAsync(
        pending,
        input.status.rootPath,
        options,
      );
      const unhandled =
        base === undefined
          ? input.status.extensions.observations.filter(
              (observation) =>
                !isPendingModuleLifecycleObservation(observation) &&
                requiresProtocolPlanning(observation, input.policy.repairProjections),
            )
          : [];
      const unhandledBlockers =
        unhandled.length === 0 ? [] : [protocolUnavailableBlocker(unhandled)];
      const blockers = [...baseResult.blockers, ...pendingSlice.blockers, ...unhandledBlockers];
      return {
        ...baseResult,
        complete: baseResult.complete && blockers.length === 0,
        files: [...baseResult.files, ...pendingSlice.files],
        artifacts: [...baseResult.artifacts, ...pendingSlice.artifacts],
        steps: [...baseResult.steps, ...pendingSlice.steps],
        blockers,
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

const EMPTY_PENDING_SLICE = { files: [], artifacts: [], steps: [], blockers: [] } as const;

/*** Delegate existing package-owner planning when present instead of replacing it. */
async function readBaseProtocolResultAsync(
  base: ApmPlanProtocolPort | undefined,
  input: Parameters<ApmPlanProtocolPort['planProtocolAsync']>[0],
): Promise<ApmPlanProtocolResult> {
  return base === undefined ? EMPTY_PROTOCOL_RESULT : base.planProtocolAsync(input);
}

/*** Plan the pending lifecycle observation only when the host supplied its trusted execution adapter. */
async function planPendingObservationAsync(
  observation: ApmExtensionObservation | undefined,
  rootPath: string,
  options: StudioProjectUpdateProtocolOptions,
) {
  if (observation === undefined) return EMPTY_PENDING_SLICE;
  if (options.pendingLifecycleExecution !== true) {
    return { ...EMPTY_PENDING_SLICE, blockers: [pendingLifecycleBlocker(observation)] };
  }
  const expectedPendingDigest = readPendingDigest(observation);
  if (expectedPendingDigest === undefined) {
    return { ...EMPTY_PENDING_SLICE, blockers: [missingPendingDigestBlocker(observation)] };
  }
  return planPendingModuleLifecycleAsync({
    rootPath,
    expectedPendingDigest,
    resolveArtifactAsync: options.resolveArtifactAsync ?? resolveCurrentStudioApmArtifactAsync,
    nowIso: options.nowIso ?? (() => new Date().toISOString()),
  });
}

/*** Identify the Studio-owned pending module lifecycle observation by stable evidence. */
function isPendingModuleLifecycleObservation(observation: ApmExtensionObservation): boolean {
  return observation.evidence.includes(STUDIO_PENDING_MODULE_LIFECYCLE_EVIDENCE);
}

/*** Read the exact pending-file precondition frozen into status evidence. */
function readPendingDigest(observation: ApmExtensionObservation): string | undefined {
  return observation.evidence
    .find((item) => item.startsWith('pending-digest:'))
    ?.slice('pending-digest:'.length);
}

/*** Mirror APM's owner-planning requirement for evidence not handled by Studio's local planner. */
function requiresProtocolPlanning(
  observation: ApmExtensionObservation,
  repairProjections: boolean,
): boolean {
  return (
    observation.migration === 'pending' || (repairProjections && observation.projection === 'stale')
  );
}

/*** Block apply when this service instance has no trusted module-lifecycle executor. */
function pendingLifecycleBlocker(observation: ApmExtensionObservation): ApmPlanBlocker {
  return {
    code: 'protocol.studio-pending-module-lifecycle',
    scope: { kind: 'projection', id: STUDIO_PENDING_MODULE_LIFECYCLE_PROJECTION_ID },
    evidence: observation.evidence,
    reason:
      'Studio module removals are queued, but this host did not compose the trusted module-lifecycle owner executor.',
    nextAction:
      'Use the normal Studio host or compose its trusted pending-module lifecycle adapter.',
  };
}

/*** Block planning when pending evidence lacks the immutable file digest required for reviewed execution. */
function missingPendingDigestBlocker(observation: ApmExtensionObservation): ApmPlanBlocker {
  return {
    code: 'protocol.studio-pending-module-lifecycle-evidence-incomplete',
    scope: { kind: 'projection', id: STUDIO_PENDING_MODULE_LIFECYCLE_PROJECTION_ID },
    evidence: observation.evidence,
    reason: 'Pending module lifecycle evidence is missing its reviewed file digest.',
    nextAction: 'Refresh Studio status before planning pending module removals.',
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
