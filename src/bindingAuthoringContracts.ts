import type {
  BindingOperationRef,
  DataSourceDiagnostic,
  UiBindableEventMeta,
  UiBindablePropMeta,
  UiBindableValueMeta,
} from '@ankhorage/contracts';

export type StudioBindingCompatibility = 'compatible' | 'incompatible' | 'unknown';

export interface StudioBindablePropOption {
  readonly name: string;
  readonly label: string;
  readonly meta: UiBindablePropMeta;
}

export interface StudioBindableEventOption {
  readonly name: string;
  readonly label: string;
  readonly meta: UiBindableEventMeta;
}

export interface StudioBindingInputFieldOption {
  readonly name: string;
  readonly label: string;
  readonly value: UiBindableValueMeta;
  readonly required: boolean;
}

export interface StudioBindingResponsePathOption {
  readonly path: string;
  readonly label: string;
  readonly value: UiBindableValueMeta;
}

export interface StudioBindingOperationOption {
  readonly operation: BindingOperationRef;
  readonly label: string;
  readonly sourceLabel: string;
  readonly inputFields: readonly StudioBindingInputFieldOption[];
  readonly responsePaths: readonly StudioBindingResponsePathOption[];
}

export interface StudioBindingDiagnostic {
  readonly code:
    | 'incompatible-response'
    | 'missing-action'
    | 'missing-binding-meta'
    | 'missing-response-path'
    | 'unknown-event'
    | 'unknown-prop';
  readonly message: string;
  readonly severity: 'error' | 'warning';
  readonly path?: string;
  readonly runtimeDiagnostics?: readonly DataSourceDiagnostic[];
}
