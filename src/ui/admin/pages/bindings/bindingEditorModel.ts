import type {
  BindingInputMap,
  BindingOperationRef,
  BindingValue,
  EventBinding,
  PropBinding,
  UiBindableValueMeta,
  UiComponentEventPayloadFieldMeta,
} from '@ankhorage/contracts';
import { findByKey } from '@ankhorage/utility/array';
import { createCompositeKey, stringifyJson } from '@ankhorage/utility/string';

import type {
  StudioBindingInputFieldOption,
  StudioBindingOperationOption,
} from '../../../../bindingAuthoringModel';
import { createBindingLiteralDefaultValue } from './createBindingLiteralDefaultValue';

export type StudioBindingSourceKind = PropBinding['source']['kind'];
export type StudioEventInputSourceKind = 'event' | 'literal';

export const STUDIO_BINDING_SOURCE_OPTIONS: readonly {
  value: StudioBindingSourceKind;
  label: string;
}[] = [
  { value: 'literal', label: 'Literal' },
  { value: 'state', label: 'State' },
  { value: 'context', label: 'Context' },
  { value: 'operation', label: 'Operation result' },
];

/*** Create the default property-binding shape for one selected Studio binding source kind and value metadata. */
export function createStudioPropBindingForSource(
  kind: StudioBindingSourceKind,
  value: UiBindableValueMeta,
  operations: readonly StudioBindingOperationOption[],
): PropBinding {
  if (kind === 'literal') return { source: { kind, value: createDefaultBindingValue(value) } };
  if (kind === 'state' || kind === 'context') return { source: { kind, path: '' } };
  if (kind === 'event') return { source: { kind, path: '' } };

  const [operation] = operations;
  return operation
    ? { source: { kind, operation: operation.operation, path: operation.responsePaths[0]?.path } }
    : { source: { kind: 'context', path: '' } };
}

/*** Build an event binding target and optional input map from the current Studio event-input drafts. */
export function createStudioEventBinding(args: {
  readonly target:
    | { readonly kind: 'action'; readonly type: string }
    | { readonly kind: 'operation'; readonly operation: StudioBindingOperationOption['operation'] };
  readonly fields: readonly StudioBindingInputFieldOption[];
  readonly drafts: Readonly<Record<string, StudioEventInputDraft>>;
}): EventBinding {
  const input = createStudioEventInputMap(args.fields, args.drafts);
  return { target: args.target, ...(Object.keys(input).length > 0 ? { input } : {}) };
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

/***
 * Build a stable composite key from a multi-part operation identity.
 */
export function createStudioOperationKey(operation: BindingOperationRef): string {
  const { apiId, endpointId, operationId } = operation;
  return createCompositeKey([apiId, endpointId ?? '', operationId], '::');
}

/***
 * Find the first array item whose projected composite key equals a requested key.
 */
export function findStudioOperationByKey(
  operations: readonly StudioBindingOperationOption[],
  key: string,
): StudioBindingOperationOption | undefined {
  return findByKey(operations, key, (option) => createStudioOperationKey(option.operation));
}

/*** Convert event-input drafts into the canonical binding input map, omitting untouched optional literal inputs. */
function createStudioEventInputMap(
  fields: readonly StudioBindingInputFieldOption[],
  drafts: Readonly<Record<string, StudioEventInputDraft>>,
): BindingInputMap {
  return Object.fromEntries(
    fields.flatMap((field): readonly BindingInputEntry[] => {
      const draft = drafts[field.name];
      if (!draft) return [];
      if (draft.kind === 'event') {
        if (!draft.value && !field.required) return [];
        return [[field.name, { kind: 'source', source: { kind: 'event', path: draft.value } }]];
      }
      if (draft.value === undefined || (!draft.included && !field.required)) return [];
      return [[field.name, { kind: 'literal', value: draft.value }]];
    }),
  );
}

type BindingInputEntry = readonly [string, BindingInputMap[string]];

/*** Create the empty/default binding value associated with one Studio binding metadata type. */
function createDefaultBindingValue(meta: UiBindableValueMeta): BindingValue {
  return createBindingLiteralDefaultValue({ value: meta });
}

/***
 * Parse JSON and return it only when an injected/value guard accepts the structured value, otherwise return a caller fallback.
 * @utility @ankhorage/utility/json
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
 * @todo Move this reusable contract guard beside `BindingValue` in `@ankhorage/contracts` rather than Studio UI.
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
