export type StudioRuntimeProjectionStatus = 'current' | 'pending' | 'failed' | 'unknown';

export type StudioRuntimeProjectionReason =
  'applied' | 'manifest-changed' | 'projection-failed' | 'missing-evidence';

export interface StudioRuntimeProjectionState {
  readonly status: StudioRuntimeProjectionStatus;
  readonly reason: StudioRuntimeProjectionReason;
}

export interface ProjectRuntimeProjectionEvidence {
  readonly appliedSignature?: string;
  readonly failedSignature?: string;
}

export interface GeneratedFile {
  readonly path: string;
  readonly content: string;
}
