import type {
  ProjectRuntimeProjectionEvidence,
  StudioRuntimeProjectionState,
} from '../../../types/project-generation';

/*** Resolve durable runtime projection evidence against the current runtime-relevant manifest signature. */
export function resolveStudioRuntimeProjectionState(
  evidence: ProjectRuntimeProjectionEvidence | undefined,
  expectedSignature: string,
): StudioRuntimeProjectionState {
  if (!evidence) {
    return { status: 'unknown', reason: 'missing-evidence' };
  }
  if (evidence.failedSignature === expectedSignature) {
    return { status: 'failed', reason: 'projection-failed' };
  }
  if (evidence.appliedSignature === expectedSignature) {
    return { status: 'current', reason: 'applied' };
  }
  if (evidence.appliedSignature !== undefined || evidence.failedSignature !== undefined) {
    return { status: 'pending', reason: 'manifest-changed' };
  }
  return { status: 'unknown', reason: 'missing-evidence' };
}
