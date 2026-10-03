import { readFile, writeFile } from 'node:fs/promises';

import type {
  ApmApplyStepExecutionResult,
  ApmApplyStepObservation,
  ApmApplyStepPort,
  ApmPlanStep,
  ApmProjectMutation,
} from '@ankhorage/apm/types';
import { resolvePathWithinRoot } from '@ankhorage/utility/node/path';
import { isRecord } from '@ankhorage/utility/object';

import { createStudioGeneratedPackagePolicyProjectReadPort } from '../adapters/outbound/createStudioGeneratedPackagePolicyProjectReadPort';
import { readStudioGeneratedPackagePolicyHandler } from '../adapters/outbound/readStudioGeneratedPackagePolicyHandler';
import { readStudioGeneratedPackagePolicyProjectionDescriptor } from '../adapters/outbound/readStudioGeneratedPackagePolicyProjectionDescriptor';
import { currentStudioApmArtifactMatchesAsync } from '../adapters/outbound/resolveCurrentStudioApmArtifactAsync';
import { STUDIO_GENERATED_PACKAGE_POLICY_PROJECTION_ID, STUDIO_PACKAGE_NAME } from '../constants';
import { createStudioGeneratedPackagePolicyExecutionContext } from '../domain/createStudioGeneratedPackagePolicyExecutionContext';
import { readStudioGeneratedPackagePolicyMutationTarget } from '../domain/readStudioGeneratedPackagePolicyMutationTarget';

type ProjectionExecution = Extract<ApmPlanStep['execution'], { readonly kind: 'projection' }>;

/*** Compose exact reviewed Studio package-policy execution around another trusted owner executor. */
export function createStudioGeneratedPackagePolicyApplyOwnerStepPort(
  base: ApmApplyStepPort | undefined,
): ApmApplyStepPort {
  return {
    observeAsync: async (input) =>
      isPackagePolicyStep(input.step)
        ? observePackagePolicyStepAsync(input.journal.rootPath, input.step)
        : delegateObservationAsync(base, input),
    executeAsync: async (input) =>
      isPackagePolicyStep(input.step)
        ? executePackagePolicyStepAsync(input.journal.rootPath, input.step)
        : delegateExecutionAsync(base, 'executeAsync', input),
    rollbackAsync: async (input) =>
      isPackagePolicyStep(input.step)
        ? Promise.resolve({
            state: 'completed',
            evidence: ['owner-approved-snapshot-restore'],
            diagnostics: [],
          })
        : delegateExecutionAsync(base, 'rollbackAsync', input),
  };
}

/*** Observe whether the reviewed package-policy projection is already satisfied or remains pending. */
async function observePackagePolicyStepAsync(
  rootPath: string,
  step: ApmPlanStep,
): Promise<ApmApplyStepObservation> {
  if (step.execution.kind !== 'projection') {
    return { state: 'unknown', evidence: [step.id], reason: 'Projection execution is missing.' };
  }
  if (!(await currentStudioApmArtifactMatchesAsync(step.execution.artifact))) {
    return {
      state: 'conflict',
      evidence: [`${step.execution.artifact.packageName}@${step.execution.artifact.version}`],
      reason: 'Running Studio owner code no longer matches the reviewed projection artifact.',
    };
  }
  const inspection = await readStudioGeneratedPackagePolicyHandler().inspectAsync({
    descriptor: readStudioGeneratedPackagePolicyProjectionDescriptor(),
    context: createStudioGeneratedPackagePolicyExecutionContext(
      sourceVersion(step),
      step.execution.artifact,
    ),
    project: createStudioGeneratedPackagePolicyProjectReadPort(rootPath),
  });
  if (inspection.state === 'unknown') {
    return {
      state: 'unknown',
      evidence: inspection.evidence,
      ...(inspection.reason === undefined ? {} : { reason: inspection.reason }),
    };
  }
  const satisfied =
    inspection.state === 'current' &&
    inspection.generatorFingerprint === step.execution.plan.generatorFingerprint;
  return satisfied
    ? { state: 'satisfied', evidence: inspection.evidence }
    : { state: 'pending', evidence: inspection.evidence };
}

/*** Execute only mutation IDs frozen into the reviewed Studio package-policy projection plan. */
async function executePackagePolicyStepAsync(
  rootPath: string,
  step: ApmPlanStep,
): Promise<ApmApplyStepExecutionResult> {
  if (step.execution.kind !== 'projection') {
    return failedExecution(
      'studio.generated-package-policy.execution-invalid',
      'Reviewed package-policy step has no projection execution descriptor.',
      step.id,
    );
  }
  if (!(await currentStudioApmArtifactMatchesAsync(step.execution.artifact))) {
    return failedExecution(
      'studio.generated-package-policy.artifact-mismatch',
      'Running Studio owner code no longer matches the reviewed projection artifact.',
      `${step.execution.artifact.packageName}@${step.execution.artifact.version}`,
    );
  }
  try {
    await materializePackagePolicyAsync(rootPath, step.execution, sourceVersion(step));
    return {
      state: 'completed',
      evidence: step.execution.plan.mutations.map(({ id }) => id),
      diagnostics: [],
    };
  } catch (error) {
    return failedExecution(
      'studio.generated-package-policy.execution-failed',
      error instanceof Error ? error.message : 'Studio package-policy execution failed.',
      step.id,
    );
  }
}

/*** Materialize only mutation IDs frozen into the reviewed Studio projection plan. */
async function materializePackagePolicyAsync(
  rootPath: string,
  execution: ProjectionExecution,
  reviewedSourceVersion: string,
): Promise<void> {
  const byId = new Map(execution.plan.mutations.map((mutation) => [mutation.id, mutation]));
  await readStudioGeneratedPackagePolicyHandler().materializeAsync({
    descriptor: readStudioGeneratedPackagePolicyProjectionDescriptor(),
    context: createStudioGeneratedPackagePolicyExecutionContext(
      reviewedSourceVersion,
      execution.artifact,
    ),
    plan: execution.plan,
    project: {
      ...createStudioGeneratedPackagePolicyProjectReadPort(rootPath),
      applyReviewedMutationAsync: async (mutationId) => {
        const mutation = byId.get(mutationId);
        if (mutation === undefined) throw new Error(`Unreviewed mutation '${mutationId}'.`);
        await applyReviewedMutationAsync(rootPath, mutation);
      },
    },
  });
}

/*** Apply one reviewed package-policy mutation while preserving unrelated package manifest fields. */
async function applyReviewedMutationAsync(
  rootPath: string,
  mutation: ApmProjectMutation,
): Promise<void> {
  const target = readStudioGeneratedPackagePolicyMutationTarget(mutation);
  if (target === undefined) {
    throw new Error(`Unsupported generated package-policy mutation '${mutation.id}'.`);
  }
  const packagePath = resolvePathWithinRoot(rootPath, 'package.json');
  const value: unknown = JSON.parse(await readFile(packagePath, 'utf8'));
  if (!isRecord(value)) throw new Error('Generated package.json must contain an object.');
  const updated =
    target.section === 'packageManager'
      ? updatePackageManager(value, mutation)
      : updateDependencySection(value, target.section, target.name, mutation);
  await writeFile(packagePath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');
}

/*** Apply one reviewed package-manager mutation at the root manifest field. */
function updatePackageManager(
  value: Readonly<Record<string, unknown>>,
  mutation: ApmProjectMutation,
): Readonly<Record<string, unknown>> {
  if (mutation.kind === 'remove-json-pointer') {
    return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'packageManager'));
  }
  if (mutation.kind !== 'set-json-pointer') return value;
  return { ...value, packageManager: mutation.value };
}

/*** Apply one reviewed dependency entry mutation without replacing its sibling declarations. */
function updateDependencySection(
  value: Readonly<Record<string, unknown>>,
  section: 'dependencies' | 'devDependencies',
  name: string,
  mutation: ApmProjectMutation,
): Readonly<Record<string, unknown>> {
  const current = section === 'dependencies' ? value.dependencies : value.devDependencies;
  if (!isRecord(current)) {
    throw new Error(`Generated package.json must define object ${section}.`);
  }
  const next =
    mutation.kind === 'remove-json-pointer'
      ? Object.fromEntries(Object.entries(current).filter(([key]) => key !== name))
      : mutation.kind === 'set-json-pointer'
        ? { ...current, [name]: mutation.value }
        : current;
  return section === 'dependencies'
    ? { ...value, dependencies: next }
    : { ...value, devDependencies: next };
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

/*** Delegate an unrelated owner observation without claiming package-owner capability. */
async function delegateObservationAsync(
  base: ApmApplyStepPort | undefined,
  input: Parameters<ApmApplyStepPort['observeAsync']>[0],
): Promise<ApmApplyStepObservation> {
  return base === undefined
    ? {
        state: 'unknown',
        evidence: [input.step.id],
        reason: 'No trusted Studio owner adapter handles this reviewed step.',
      }
    : base.observeAsync(input);
}

/*** Delegate unrelated owner execution or rollback to the previously composed owner adapter. */
async function delegateExecutionAsync(
  base: ApmApplyStepPort | undefined,
  action: 'executeAsync' | 'rollbackAsync',
  input: Parameters<ApmApplyStepPort['executeAsync']>[0],
): Promise<ApmApplyStepExecutionResult> {
  if (base === undefined) {
    return failedExecution(
      'studio.owner-step.unavailable',
      'No trusted Studio owner adapter handles this reviewed step.',
      input.step.id,
    );
  }
  return action === 'executeAsync' ? base.executeAsync(input) : base.rollbackAsync(input);
}

/*** Build one deterministic failed trusted-owner execution result. */
function failedExecution(
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
