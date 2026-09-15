import type { ApmExtensionArtifactIdentity, ApmPlanStep } from '@ankhorage/apm/types';

const STUDIO_PACKAGE_NAME = '@ankhorage/studio';
const PROJECTION_PREFIX = 'pending-module-remove:';
const PENDING_DIGEST_PREFIX = 'pending-digest:';

export interface ReviewedPendingModuleStep {
  readonly moduleId: string;
  readonly pendingDigest: string;
  readonly artifact: ApmExtensionArtifactIdentity;
}

/*** Parse one exact Studio pending-module owner step from a reviewed APM plan. */
export function readReviewedPendingModuleStep(
  step: ApmPlanStep,
): ReviewedPendingModuleStep | undefined {
  if (step.kind !== 'projection' || step.execution.kind !== 'projection') return undefined;
  if (step.owner !== STUDIO_PACKAGE_NAME) return undefined;
  if (!step.execution.descriptor.id.startsWith(PROJECTION_PREFIX)) return undefined;
  const moduleId = step.execution.descriptor.id.slice(PROJECTION_PREFIX.length);
  const pendingDigest = step.execution.plan.evidence
    .find((evidence) => evidence.startsWith(PENDING_DIGEST_PREFIX))
    ?.slice(PENDING_DIGEST_PREFIX.length);
  return moduleId === '' || pendingDigest === undefined || pendingDigest === ''
    ? undefined
    : { moduleId, pendingDigest, artifact: step.execution.artifact };
}
