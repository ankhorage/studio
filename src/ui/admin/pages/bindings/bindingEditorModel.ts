import type {
  BindingCapabilityReference,
  BindingExpression,
  BindingInputMap,
  BindingValue,
  EventBinding,
  PropBinding,
  UiBindableValueMeta,
  UiComponentEventPayloadFieldMeta,
} from '@ankhorage/contracts';
import type { Capability } from '@ankhorage/contracts/capability';
import { findByKey } from '@ankhorage/utility/array';
import { stringifyJson } from '@ankhorage/utility/string';

import type {
  StudioBindingCapabilityOption,
  StudioBindingInputFieldOption,
} from '../../../../bindingAuthoringModel';
import { createBindingLiteralDefaultValue } from './createBindingLiteralDefaultValue';

export type StudioBindingSourceKind = 'api' | 'context' | 'literal' | 'state';
export type StudioEventInputSourceKind = 'event' | 'literal';

export const STUDIO_BINDING_SOURCE_OPTIONS: readonly {
  value: StudioBindingSourceKind;
  label: string;
}[] = [
  { value: 'literal', label: 'Literal' },
  { value: 'state', label: 'State' },
  { value: 'context', label: 'Context' },
  { value: 'api', label: 'API result' },
];

/*** Create the default property-binding shape for one selected Studio binding source kind and value metadata. */
export function createStudioPropBindingForSource(
  kind: StudioBindingSourceKind,
  value: UiBindableValueMeta,
  capabilities: readonly StudioBindingCapabilityOption[],
): PropBinding | undefined {
  if (kind === 'literal') return { value: { kind, value: createDefaultBindingValue(value) } };
  if (kind === 'state' || kind === 'context') return { value: { capability: `${kind}.` } };

  const [capability] = capabilities.filter((option) => option.capability.id.startsWith('api.'));
  return capability
    ? {
        value: {
          capability: capability.capability.id,
          path: capability.responsePaths[0]?.path,
        },
      }
    : undefined;
}

/*** Build an event binding target and optional input map from the current Studio event-input drafts. */
export function createStudioEventBinding(args: {
  readonly target: { readonly capability: Capability['id'] };
  readonly fields: readonly StudioBindingInputFieldOption[];
  readonly eventCapability: Capability['id'];
  readonly drafts: Readonly<Record<string, StudioEventInputDraft>>;
}): EventBinding {
  const input = createStudioEventInputMap(args.fields, args.drafts, args.eventCapability);
  return {
    target: {
      capability: args.target.capability,
      ...(Object.keys(input).length > 0 ? { input } : {}),
    },
  };
}

export type StudioEventInputDraft =
  | {
      readonly kind: 'event';
      readonly value: string;
    }
  | {
      readonly kind: 'literal';
      readonly value: BindingValue | undefined;
      readonly included: boolean;
    };

/*** Initialize event-input drafts by matching operation input fields to same-path event payload fields, otherwise keeping optional literals omitted until authored. */
export function createStudioEventInputDrafts(
  fields: readonly StudioBindingInputFieldOption[],
  eventFields: readonly UiComponentEventPayloadFieldMeta[],
): Readonly<Record<string, StudioEventInputDraft>> {
  return fields.reduce<Readonly<Record<string, StudioEventInputDraft>>>((drafts, field) => {
    const matchingEventField = eventFields.find((candidate) => candidate.path === field.name);
    const draft: StudioEventInputDraft = matchingEventField
      ? { kind: 'event', value: matchingEventField.path }
      : {
          kind: 'literal',
          value: createBindingLiteralDefaultValue(field),
          included: field.required,
        };
    return { ...drafts, [field.name]: draft };
  }, {});
}

/*** Parse one binding-editor text input according to the declared binding value metadata and Studio fallback semantics. */
export function parseStudioBindingLiteral(input: string, meta: UiBindableValueMeta): BindingValue {
  if (meta.type === 'boolean') return input === 'true';
  if (meta.type === 'number') {
    const number = Number(input);
    return Number.isFinite(number) ? number : 0;
  }
  if (meta.type === 'array') return parseStructuredValue(input, []);
  if (meta.type === 'object' || meta.type === 'record' || meta.type === 'imageAsset') {
    return parseStructuredValue(input, {});
  }
  return input;
}

/***
 * Format a JSON-compatible value for text editing while preserving strings verbatim.
 */
export function formatStudioBindingLiteral(value: BindingValue): string {
  return typeof value === 'string' ? value : stringifyJson(value, { space: 0 });
}

/*** Find one authorable capability through its canonical capability id. */
export function findStudioBindingCapabilityById(
  capabilities: readonly StudioBindingCapabilityOption[],
  id: string,
): StudioBindingCapabilityOption | undefined {
  return findByKey(capabilities, id, (option) => option.capability.id);
}

/*** Convert event-input drafts into the canonical binding input map, omitting untouched optional literal inputs. */
function createStudioEventInputMap(
  fields: readonly StudioBindingInputFieldOption[],
  drafts: Readonly<Record<string, StudioEventInputDraft>>,
  eventCapability: Capability['id'],
): BindingInputMap {
  return Object.fromEntries(
    fields.flatMap((field): readonly BindingInputEntry[] => {
      const draft = drafts[field.name];
      if (!draft) return [];
      if (draft.kind === 'event') {
        if (!draft.value && !field.required) return [];
        return [[field.name, createEventCapabilityExpression(draft.value, eventCapability)]];
      }
      if (draft.value === undefined || (!draft.included && !field.required)) return [];
      return [[field.name, { kind: 'literal', value: draft.value }]];
    }),
  );
}

/*** Create the canonical reference to the selected component event payload. */
function createEventCapabilityExpression(
  path: string,
  capability: Capability['id'],
): BindingExpression {
  return { capability, path } satisfies BindingCapabilityReference;
}

type BindingInputEntry = readonly [string, BindingInputMap[string]];

/*** Create the empty/default binding value associated with one Studio binding metadata type. */
function createDefaultBindingValue(meta: UiBindableValueMeta): BindingValue {
  return createBindingLiteralDefaultValue({ value: meta });
}

/***
 * Parse JSON and return it only when an injected/value guard accepts the structured value, otherwise return a caller fallback.
 * Utility candidate: @ankhorage/utility/json
 */
function parseStructuredValue(input: string, fallback: BindingValue): BindingValue {
  try {
    const value: unknown = JSON.parse(input);
    return isBindingValue(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

/***
 * Recursively validate the canonical JSON-like binding value contract.
 * Follow-up: Move this reusable contract guard beside `BindingValue` in `@ankhorage/contracts` rather than Studio UI.
 */
function isBindingValue(value: unknown): value is BindingValue {
  if (value === null) return true;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return true;
  }
  if (Array.isArray(value)) return value.every(isBindingValue);
  if (typeof value !== 'object') return false;
  return Object.values(value as Record<string, unknown>).every(isBindingValue);
}
