import type { MediaAsset, MediaAssetKind } from '@ankhorage/contracts';

export type StudioMediaPickerSource = 'file' | 'photo-library';
export type StudioMediaIngestTarget = 'storage' | 'bundled';

export interface StudioMediaPickerInput {
  readonly source: StudioMediaPickerSource;
  readonly mediaKinds?: readonly MediaAssetKind[];
}

export interface StudioMediaPickerSelection {
  readonly kind: MediaAssetKind;
  readonly name: string;
  readonly body: Uint8Array;
  readonly contentType?: string;
  readonly sizeBytes?: number;
  readonly width?: number;
  readonly height?: number;
  readonly durationMs?: number;
}

export type StudioMediaPickerFailureReason =
  'cancelled' | 'empty-selection' | 'picker-failed' | 'read-failed' | 'unsupported-kind';

export type StudioMediaPickerResult =
  | { readonly ok: true; readonly selection: StudioMediaPickerSelection }
  | { readonly ok: false; readonly reason: StudioMediaPickerFailureReason };

export interface StudioMediaPickerAdapter {
  pick(input: StudioMediaPickerInput): Promise<StudioMediaPickerResult>;
}

export type StudioMediaIngestResult =
  | { readonly ok: true; readonly asset: MediaAsset }
  | { readonly ok: false; readonly reason: string };
