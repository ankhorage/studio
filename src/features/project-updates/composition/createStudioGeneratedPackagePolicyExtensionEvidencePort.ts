import type {
  ApmExtensionArtifactIdentity,
  ApmExtensionEvidence,
  ApmProjectionInspectionResult,
  ApmStatusDiagnostic,
  ApmStatusExtensionEvidencePort,
} from '@ankhorage/apm/types';

import type { StudioGeneratedPackagePolicySource } from '../../../types/project-updates';
import { createStudioGeneratedPackagePolicyProjectReadPort } from '../adapters/outbound/createStudioGeneratedPackagePolicyProjectReadPort';
import { readStudioGeneratedPackagePolicyHandler } from '../adapters/outbound/readStudioGeneratedPackagePolicyHandler';
import { readStudioGeneratedPackagePolicyProjectionDescriptor } from '../adapters/outbound/readStudioGeneratedPackagePolicyProjectionDescriptor';
import type { resolveCurrentStudioApmArtifactAsync } from '../adapters/outbound/resolveCurrentStudioApmArtifactAsync';
import { STUDIO_GENERATED_PACKAGE_POLICY_PROJECTION_ID, STUDIO_PACKAGE_NAME } from '../constants';
import { createStudioGeneratedPackagePolicyExecutionContext } from '../domain/createStudioGeneratedPackagePolicyExecutionContext';
import { readStudioGeneratedPackagePolicyInventorySource } from '../domain/readStudioGeneratedPackagePolicyInventorySource';

/*** Compose current Studio generated-package-policy inspection around existing owner evidence. */
export function createStudioGeneratedPackagePolicyExtensionEvidencePort(
  base: ApmStatusExtensionEvidencePort | undefined,
  resolveArtifactAsync: typeof resolveCurrentStudioApmArtifactAsync,
): ApmStatusExtensionEvidencePort {
  return {
    inspectExtensionEvidenceAsync: async (input) => {
      const [baseEvidence, policyEvidence] = await Promise.all([
        base === undefined
          ? Promise.resolve(emptyExtensionEvidence())
          : base.inspectExtensionEvidenceAsync(input),
        inspectPolicyEvidenceAsync(input.rootPath, input.inventory, resolveArtifactAsync),
      ]);
      return mergeExtensionEvidence(baseEvidence, policyEvidence);
    },
  };
}

/*** Resolve source and target artifact before inspecting Studio projection state. */
async function inspectPolicyEvidenceAsync(
  rootPath: string,
  inventory: Parameters<
    ApmStatusExtensionEvidencePort['inspectExtensionEvidenceAsync']
  >[0]['inventory'],
  resolveArtifactAsync: typeof resolveCurrentStudioApmArtifactAsync,
): Promise<ApmExtensionEvidence> {
  const source = readStudioGeneratedPackagePolicyInventorySource(inventory);
  if (source === undefined) return emptyExtensionEvidence();
  const artifactResolution = await resolveArtifactAsync(rootPath);
  if (artifactResolution.state !== 'resolved') {
    return failedExtensionEvidence(
      'studio.generated-package-policy.artifact-unavailable',
      artifactResolution.reason,
      artifactResolution.evidence,
    );
  }
  return inspectResolvedPolicyAsync(rootPath, source, artifactResolution.artifact);
}

/*** Inspect package policy using only the exact reviewed current Studio artifact. */
async function inspectResolvedPolicyAsync(
  rootPath: string,
  source: StudioGeneratedPackagePolicySource,
  artifact: ApmExtensionArtifactIdentity,
): Promise<ApmExtensionEvidence> {
  const context = createStudioGeneratedPackagePolicyExecutionContext(source.version, artifact);
  const inspection = await readStudioGeneratedPackagePolicyHandler().inspectAsync({
    descriptor: readStudioGeneratedPackagePolicyProjectionDescriptor(),
    context,
    project: createStudioGeneratedPackagePolicyProjectReadPort(rootPath),
  });
  return projectionEvidence(source, artifact.version, inspection);
}

/*** Convert one Studio projection inspection into stable APM owner evidence. */
function projectionEvidence(
  source: StudioGeneratedPackagePolicySource,
  targetVersion: string,
  inspection: ApmProjectionInspectionResult,
): ApmExtensionEvidence {
  return {
    state: 'available',
    complete: inspection.state !== 'unknown',
    observations: [
      {
        packageId: source.packageId,
        owner: STUDIO_PACKAGE_NAME,
        projection: inspection.state,
        migration: 'not-applicable',
        evidence: [
          `projection:${STUDIO_GENERATED_PACKAGE_POLICY_PROJECTION_ID}`,
          `source:${source.version}`,
          `target:${targetVersion}`,
          ...inspection.evidence,
        ],
        ...(inspection.reason === undefined ? {} : { reason: inspection.reason }),
        ...(inspection.state === 'stale'
          ? {
              nextAction: 'Apply the reviewed Studio update to reconcile generated package policy.',
            }
          : {}),
      },
    ],
    diagnostics: inspection.state === 'unknown' ? [unknownProjectionDiagnostic(inspection)] : [],
  };
}

/*** Describe an unknown projection state without treating it as current. */
function unknownProjectionDiagnostic(
  inspection: ApmProjectionInspectionResult,
): ApmStatusDiagnostic {
  return {
    code: 'studio.generated-package-policy.unknown',
    severity: 'error',
    scope: { kind: 'projection', id: STUDIO_GENERATED_PACKAGE_POLICY_PROJECTION_ID },
    evidence: inspection.evidence,
    reason: inspection.reason ?? 'Studio generated package policy could not be inspected safely.',
    nextAction: 'Repair package.json before applying Studio-managed updates.',
  };
}

/*** Merge independent extension evidence while preserving fail-closed completeness. */
function mergeExtensionEvidence(
  base: ApmExtensionEvidence,
  policy: ApmExtensionEvidence,
): ApmExtensionEvidence {
  return {
    state: base.state === 'available' || policy.state === 'available' ? 'available' : 'unavailable',
    complete: base.complete && policy.complete,
    observations: [...base.observations, ...policy.observations],
    diagnostics: [...base.diagnostics, ...policy.diagnostics],
  };
}

/*** Return explicit empty owner evidence for projects that do not embed Studio. */
function emptyExtensionEvidence(): ApmExtensionEvidence {
  return {
    state: 'unavailable',
    complete: true,
    observations: [],
    diagnostics: [],
  };
}

/*** Return incomplete owner evidence when current target artifact identity cannot be established. */
function failedExtensionEvidence(
  code: string,
  reason: string,
  evidence: readonly string[],
): ApmExtensionEvidence {
  return {
    state: 'available',
    complete: false,
    observations: [],
    diagnostics: [
      {
        code,
        severity: 'error',
        scope: { kind: 'projection', id: STUDIO_GENERATED_PACKAGE_POLICY_PROJECTION_ID },
        evidence,
        reason,
      },
    ],
  };
}
