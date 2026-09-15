import type { ApmExtensionArtifactIdentity, ApmPlanStep } from '@ankhorage/apm/types';

const STUDIO_PACKAGE_NAME = '@ankhorage/studio';
const PROJECTION_PREFIX = 'pending-module-remove:';
const PENDING_DIGEST_PREFIX = 'pending-digest:';
const MANIFEST_DIGEST_PREFIX = 'manifest-digest:';

export interface ReviewedPendingModuleStep {
  readonly moduleId: string;
  readonly pendingDigest: string;
  readonly manifestDigest: string;
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
  const pendingDigest = readEvidenceDigest(step.execution.plan.evidence, PENDING_DIGEST_PREFIX);
  const manifestDigest = readEvidenceDigest(step.execution.plan.evidence, MANIFEST_DIGEST_PREFIX);
  return moduleId === '' || pendingDigest === undefined || manifestDigest === undefined
    ? undefined
    : { moduleId, pendingDigest, manifestDigest, artifact: step.execution.artifact };
}

/*** Read one required non-empty digest from reviewed step evidence. */
function readEvidenceDigest(
  evidence: readonly string[],
  prefix: string,
): string | undefined {
  const value = evidence.find((item) => item.startsWith(prefix))?.slice(prefix.length);
  return value === undefined || value === '' ? undefined : value;
}
