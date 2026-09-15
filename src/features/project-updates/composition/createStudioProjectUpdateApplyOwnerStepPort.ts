import type {
  ApmApplyStepExecutionResult,
  ApmApplyStepObservation,
  ApmApplyStepPort,
} from '@ankhorage/apm/types';

import { readCurrentStudioApmArtifactBindingAsync } from '../adapters/outbound/resolveCurrentStudioApmArtifactAsync';
import { readPendingModuleLifecycleStateAsync } from '../adapters/outbound/readPendingModuleLifecycleStateAsync';
import { readStudioManifestDigestAsync } from '../adapters/outbound/readStudioManifestDigestAsync';
import type { StudioPendingModuleLifecyclePort } from '../application/StudioPendingModuleLifecyclePort';
import { readReviewedPendingModuleStep } from '../domain/pendingModulePlanStep';

/*** Compose Studio pending-module execution around any pre-existing trusted owner step adapter. */
export function createStudioProjectUpdateApplyOwnerStepPort(
  lifecycle: StudioPendingModuleLifecyclePort,
  base?: ApmApplyStepPort,
): ApmApplyStepPort {
  return {
    observeAsync: async (input) => {
      const reviewed = readReviewedPendingModuleStep(input.step);
      return reviewed === undefined
        ? delegateObservationAsync(base, input)
        : observePendingModuleAsync(input.journal.rootPath, reviewed, lifecycle);
    },
    executeAsync: async (input) => {
      const reviewed = readReviewedPendingModuleStep(input.step);
      return reviewed === undefined
        ? delegateExecutionAsync(base, 'executeAsync', input)
        : executePendingModuleAsync(input.journal.rootPath, reviewed, lifecycle);
    },
    rollbackAsync: async (input) => {
      const reviewed = readReviewedPendingModuleStep(input.step);
      return reviewed === undefined
        ? delegateExecutionAsync(base, 'rollbackAsync', input)
        : unsupportedRollback(input.step.id);
    },
  };
}

type ReviewedStep = NonNullable<ReturnType<typeof readReviewedPendingModuleStep>>;
type ApplyStepInput = Parameters<ApmApplyStepPort['observeAsync']>[0];

/*** Observe exact pending/manifest/artifact preconditions before one irreversible module effect. */
async function observePendingModuleAsync(
  rootPath: string,
  reviewed: ReviewedStep,
  lifecycle: StudioPendingModuleLifecyclePort,
): Promise<ApmApplyStepObservation> {
  const binding = await bindingObservationAsync(reviewed);
  if (binding !== undefined) return binding;
  const pending = await pendingObservationAsync(rootPath, reviewed.pendingDigest);
  if (pending !== undefined) return pending;
  const manifest = await manifestObservationAsync(rootPath, reviewed.manifestDigest);
  if (manifest !== undefined) return manifest;
  const installed = await lifecycle.isModuleInstalledAsync(rootPath, reviewed.moduleId);
  if (installed === undefined) {
    return {
      state: 'unknown',
      evidence: [`module:${reviewed.moduleId}`],
      reason: 'Orchestrator could not determine the reviewed module installation state.',
    };
  }
  return installed
    ? { state: 'pending', evidence: [`module-installed:${reviewed.moduleId}`] }
    : { state: 'satisfied', evidence: [`module-removed:${reviewed.moduleId}`] };
}

/*** Execute exactly one reviewed Orchestrator removal after all frozen preconditions still match. */
async function executePendingModuleAsync(
  rootPath: string,
  reviewed: ReviewedStep,
  lifecycle: StudioPendingModuleLifecyclePort,
): Promise<ApmApplyStepExecutionResult> {
  const observation = await observePendingModuleAsync(rootPath, reviewed, lifecycle);
  if (observation.state === 'satisfied') return completed(observation.evidence);
  if (observation.state !== 'pending') return observationFailure(observation);

  await lifecycle.removeModuleAsync(rootPath, reviewed.moduleId);
  const installed = await lifecycle.isModuleInstalledAsync(rootPath, reviewed.moduleId);
  if (installed === false) return completed([`module-removed:${reviewed.moduleId}`]);
  return installed === undefined
    ? {
        state: 'unknown',
        evidence: [`module:${reviewed.moduleId}`],
        diagnostics: [],
        failure: {
          code: 'studio.pending-module-lifecycle.observation-unavailable',
          reason: 'Module removal returned but its postcondition could not be observed.',
          evidence: [reviewed.moduleId],
        },
      }
    : failed(
        'studio.pending-module-lifecycle.remove-incomplete',
        'Orchestrator returned from removal but the reviewed module remains installed.',
        reviewed.moduleId,
      );
}

/*** Reject a reviewed step when the running Studio package does not match its frozen owner artifact. */
async function bindingObservationAsync(
  reviewed: ReviewedStep,
): Promise<ApmApplyStepObservation | undefined> {
  const binding = await readCurrentStudioApmArtifactBindingAsync();
  const matches =
    reviewed.artifact.packageName === binding.packageName &&
    reviewed.artifact.version === binding.version &&
    reviewed.artifact.descriptorDigest === binding.descriptorDigest;
  return matches
    ? undefined
    : {
        state: 'conflict',
        evidence: [
          `${reviewed.artifact.packageName}@${reviewed.artifact.version}`,
          `${binding.packageName}@${binding.version}`,
          reviewed.artifact.descriptorDigest,
          binding.descriptorDigest,
        ],
        reason: 'Loaded Studio owner code no longer matches the reviewed immutable artifact binding.',
      };
}

/*** Require the exact pending-state digest to remain unchanged until native APM file finalization. */
async function pendingObservationAsync(
  rootPath: string,
  expectedDigest: string,
): Promise<ApmApplyStepObservation | undefined> {
  const pending = await readPendingModuleLifecycleStateAsync(rootPath);
  if (pending.state === 'valid' && pending.digest === expectedDigest) return undefined;
  if (pending.state === 'unreadable') {
    return {
      state: 'unknown',
      evidence: [pending.reason],
      reason: 'Studio pending module lifecycle state cannot be read safely.',
    };
  }
  return {
    state: 'conflict',
    evidence: [expectedDigest, pending.state === 'valid' ? pending.digest : pending.state],
    reason: 'Studio pending module lifecycle state changed after the reviewed plan was created.',
  };
}

/*** Require the canonical manifest to remain byte-identical before irreversible Orchestrator effects. */
async function manifestObservationAsync(
  rootPath: string,
  expectedDigest: string,
): Promise<ApmApplyStepObservation | undefined> {
  try {
    const actualDigest = await readStudioManifestDigestAsync(rootPath);
    return actualDigest === expectedDigest
      ? undefined
      : {
          state: 'conflict',
          evidence: [expectedDigest, actualDigest],
          reason: 'Studio manifest changed after the reviewed pending-module plan was created.',
        };
  } catch (error) {
    return {
      state: 'unknown',
      evidence: [error instanceof Error ? error.message : 'unknown manifest read failure'],
      reason: 'Studio manifest cannot be read safely before the reviewed module removal.',
    };
  }
}

/*** Delegate an unrelated owner observation or remain explicitly unavailable. */
async function delegateObservationAsync(
  base: ApmApplyStepPort | undefined,
  input: ApplyStepInput,
): Promise<ApmApplyStepObservation> {
  return base === undefined
    ? {
        state: 'unknown',
        evidence: [input.step.id],
        reason: 'No trusted Studio owner adapter handles this reviewed step.',
      }
    : base.observeAsync(input);
}

/*** Delegate unrelated owner execution/rollback without swallowing its result. */
async function delegateExecutionAsync(
  base: ApmApplyStepPort | undefined,
  action: 'executeAsync' | 'rollbackAsync',
  input: ApplyStepInput,
): Promise<ApmApplyStepExecutionResult> {
  return base === undefined
    ? failed(
        'studio.owner-step.unavailable',
        'No trusted Studio owner adapter handles this reviewed step.',
        input.step.id,
      )
    : base[action](input);
}

/*** Convert a non-executable observation into a deterministic owner-step failure. */
function observationFailure(observation: ApmApplyStepObservation): ApmApplyStepExecutionResult {
  return failed(
    'studio.pending-module-lifecycle.precondition-changed',
    observation.reason ?? 'Reviewed pending module lifecycle preconditions are not executable.',
    ...observation.evidence,
  );
}

/*** Report one completed trusted owner effect. */
function completed(evidence: readonly string[]): ApmApplyStepExecutionResult {
  return { state: 'completed', evidence, diagnostics: [] };
}

/*** Report one deterministic owner execution failure. */
function failed(
  code: string,
  reason: string,
  ...evidence: readonly string[]
): ApmApplyStepExecutionResult {
  return {
    state: 'failed',
    evidence,
    diagnostics: [],
    failure: { code, reason, evidence },
  };
}

/*** Keep dynamic Orchestrator effects explicitly non-reversible. */
function unsupportedRollback(stepId: string): ApmApplyStepExecutionResult {
  return failed(
    'studio.pending-module-lifecycle.rollback-unsupported',
    'Reviewed Orchestrator module removal is not transactionally reversible by Studio.',
    stepId,
  );
}
