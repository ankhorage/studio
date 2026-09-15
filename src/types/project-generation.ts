export type StudioRuntimeProjectionStatus = 'current' | 'pending' | 'failed' | 'unknown';

export interface StudioRuntimeProjectionFailureEvidence {
  readonly code: 'runtime-projection-failed';
  readonly at: string;
}

export interface StudioRuntimeProjectionState {
  readonly status: StudioRuntimeProjectionStatus;
  readonly desiredSignature: string | null;
  readonly appliedSignature: string | null;
  readonly failure?: StudioRuntimeProjectionFailureEvidence;
}
