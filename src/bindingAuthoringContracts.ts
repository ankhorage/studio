import type {
  UiBindableEventMeta,
  UiBindablePropMeta,
  UiBindableValueMeta,
} from '@ankhorage/contracts';
import type { Capability } from '@ankhorage/contracts/capability';

import type { AuthoringStructure } from './types/authoring-engine';

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
  readonly authoring?: AuthoringStructure;
}

export interface StudioBindingResponsePathOption {
  readonly path: string;
  readonly label: string;
  readonly value: UiBindableValueMeta;
}

export interface StudioBindingCapabilityOption {
  readonly capability: Capability;
  readonly label: string;
  readonly apiLabel: string;
  readonly inputFields: readonly StudioBindingInputFieldOption[];
  readonly responsePaths: readonly StudioBindingResponsePathOption[];
}

export interface StudioBindingDiagnostic {
  readonly code:
    | 'incompatible-input'
    | 'incompatible-response'
    | 'missing-capability'
    | 'missing-binding-meta'
    | 'missing-event-payload-meta'
    | 'missing-input'
    | 'missing-capability-reference'
    | 'missing-response-path'
    | 'unknown-event'
    | 'unknown-prop';
  readonly message: string;
  readonly severity: 'error' | 'warning';
  readonly path?: string;
}
