import type { ApmVerifyCheckResult, ApmVerifyStepPort } from '@ankhorage/apm/types';

import { currentStudioApmArtifactMatchesAsync } from '../adapters/outbound/resolveCurrentStudioApmArtifactAsync';
import type { StudioPendingModuleLifecyclePort } from '../application/StudioPendingModuleLifecyclePort';
import { readReviewedPendingModuleStep } from '../domain/pendingModulePlanStep';

/*** Compose Studio pending-module verification around any pre-existing trusted owner verifier. */
export function createStudioProjectUpdateVerifyOwnerStepPort(
  lifecycle: StudioPendingModuleLifecyclePort,
  base?: ApmVerifyStepPort,
): ApmVerifyStepPort {
  return {
    verifyAsync: async (input) => {
      const reviewed = readReviewedPendingModuleStep(input.step);
      return reviewed === undefined
        ? delegateVerifyAsync(base, input)
        : [await verifyPendingModuleAsync(input.journal.rootPath, input.step.id, reviewed, lifecycle)];
    },
  };
}

type VerifyInput = Parameters<ApmVerifyStepPort['verifyAsync']>[0];
type ReviewedStep = NonNullable<ReturnType<typeof readReviewedPendingModuleStep>>;

/*** Verify the immutable owner binding and exact Orchestrator module postcondition. */
async function verifyPendingModuleAsync(
  rootPath: string,
  stepId: string,
  reviewed: ReviewedStep,
  lifecycle: StudioPendingModuleLifecyclePort,
): Promise<ApmVerifyCheckResult> {
  if (!(await currentStudioApmArtifactMatchesAsync(reviewed.artifact))) {
    return {
      id: `verify:${stepId}`,
      kind: 'projection',
      status: 'unknown',
      evidence: [`${reviewed.artifact.packageName}@${reviewed.artifact.version}`],
      reason: 'Loaded Studio owner code no longer matches the reviewed immutable artifact binding.',
      nextAction: 'Verify again with the exact reviewed Studio owner artifact.',
    };
  }
  const installed = await lifecycle.isModuleInstalledAsync(rootPath, reviewed.moduleId);
  if (installed === undefined) {
    return {
      id: `verify:${stepId}`,
      kind: 'projection',
      status: 'unknown',
      evidence: [`module:${reviewed.moduleId}`],
      reason: 'Orchestrator could not determine the reviewed module installation state.',
    };
  }
  return installed
    ? {
        id: `verify:${stepId}`,
        kind: 'projection',
        status: 'failed',
        evidence: [`module-installed:${reviewed.moduleId}`],
        reason: 'Reviewed pending module remains installed after the APM operation.',
      }
    : {
        id: `verify:${stepId}`,
        kind: 'projection',
        status: 'passed',
        evidence: [`module-removed:${reviewed.moduleId}`],
      };
}

/*** Delegate unrelated owner verification or keep the missing verifier explicit. */
async function delegateVerifyAsync(
  base: ApmVerifyStepPort | undefined,
  input: VerifyInput,
): Promise<readonly ApmVerifyCheckResult[]> {
  return base === undefined
    ? [
        {
          id: `verify:${input.step.id}`,
          kind: input.step.kind === 'migration' ? 'migration' : 'projection',
          status: 'unknown',
          evidence: [input.step.id],
          reason: 'No trusted Studio owner verifier handles this reviewed step.',
        },
      ]
    : base.verifyAsync(input);
}
