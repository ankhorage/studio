import type { ApmPlanStep, ApmVerifyCheckResult, ApmVerifyStepPort } from '@ankhorage/apm/types';

import { createStudioGeneratedPackagePolicyProjectReadPort } from '../adapters/outbound/createStudioGeneratedPackagePolicyProjectReadPort';
import { readStudioGeneratedPackagePolicyHandler } from '../adapters/outbound/readStudioGeneratedPackagePolicyHandler';
import { readStudioGeneratedPackagePolicyProjectionDescriptor } from '../adapters/outbound/readStudioGeneratedPackagePolicyProjectionDescriptor';
import { currentStudioApmArtifactMatchesAsync } from '../adapters/outbound/resolveCurrentStudioApmArtifactAsync';
import { STUDIO_GENERATED_PACKAGE_POLICY_PROJECTION_ID, STUDIO_PACKAGE_NAME } from '../constants';
import { createStudioGeneratedPackagePolicyExecutionContext } from '../domain/createStudioGeneratedPackagePolicyExecutionContext';

/*** Compose exact Studio package-policy verification around another trusted owner verifier. */
export function createStudioGeneratedPackagePolicyVerifyOwnerStepPort(
  base: ApmVerifyStepPort | undefined,
): ApmVerifyStepPort {
  return {
    verifyAsync: async (input) =>
      isPackagePolicyStep(input.step)
        ? [await verifyPackagePolicyStepAsync(input.journal.rootPath, input.step)]
        : delegateVerifyAsync(base, input),
  };
}

/*** Verify the exact reviewed target owner generator against the resulting generated app. */
async function verifyPackagePolicyStepAsync(
  rootPath: string,
  step: ApmPlanStep,
): Promise<ApmVerifyCheckResult> {
  if (step.execution.kind !== 'projection') {
    return {
      id: `verify:${step.id}`,
      kind: 'projection',
      status: 'unknown',
      evidence: [step.id],
      reason: 'Reviewed package-policy projection execution is missing.',
    };
  }
  if (!(await currentStudioApmArtifactMatchesAsync(step.execution.artifact))) {
    return {
      id: `verify:${step.id}`,
      kind: 'projection',
      status: 'unknown',
      evidence: [`${step.execution.artifact.packageName}@${step.execution.artifact.version}`],
      reason: 'Running Studio owner code no longer matches the reviewed projection artifact.',
    };
  }
  const result = await readStudioGeneratedPackagePolicyHandler().verifyAsync({
    descriptor: readStudioGeneratedPackagePolicyProjectionDescriptor(),
    context: createStudioGeneratedPackagePolicyExecutionContext(
      sourceVersion(step),
      step.execution.artifact,
    ),
    plan: step.execution.plan,
    project: {
      ...createStudioGeneratedPackagePolicyProjectReadPort(rootPath),
      applyReviewedMutationAsync: () =>
        Promise.reject(new Error('Verification must not mutate generated package policy.')),
    },
  });
  return {
    id: `verify:${step.id}`,
    kind: 'projection',
    status: result.valid ? 'passed' : 'failed',
    evidence: result.evidence,
    ...(result.reason === undefined ? {} : { reason: result.reason }),
  };
}

/*** Read the reviewed source Studio version frozen into projection step evidence. */
function sourceVersion(step: ApmPlanStep): string {
  const value = step.evidence
    .find((item) => item.startsWith('source:'))
    ?.slice('source:'.length);
  if (value === undefined) throw new Error('Reviewed Studio projection step has no source version.');
  return value;
}

/*** Identify only the canonical Studio generated-package-policy projection step. */
function isPackagePolicyStep(step: ApmPlanStep): boolean {
  return (
    step.owner === STUDIO_PACKAGE_NAME &&
    step.execution.kind === 'projection' &&
    step.execution.descriptor.id === STUDIO_GENERATED_PACKAGE_POLICY_PROJECTION_ID
  );
}

/*** Delegate unrelated owner verification without hiding a missing trusted verifier. */
async function delegateVerifyAsync(
  base: ApmVerifyStepPort | undefined,
  input: Parameters<ApmVerifyStepPort['verifyAsync']>[0],
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
