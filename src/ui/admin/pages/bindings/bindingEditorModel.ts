import type {
  BindingInputMap,
  BindingOperationRef,
  BindingValue,
  EventBinding,
  PropBinding,
  UiBindableValueMeta,
  UiComponentEventPayloadFieldMeta,
} from '@ankhorage/contracts';

import type {
  StudioBindingInputFieldOption,
  StudioBindingOperationOption,
} from '../../../../bindingAuthoringModel';
import type { AuthoringStructure } from '../../../../types/authoring-engine';

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
      readonly value: BindingValue;
      readonly authored: boolean;
    };

/*** Initialize event-input drafts from event payload matches or typed defaults derived from neutral authoring semantics. */
export function createStudioEventInputDrafts(
  fields: readonly StudioBindingInputFieldOption[],
  eventFields: readonly UiComponentEventPayloadFieldMeta[],
): Readonly<Record<string, StudioEventInputDraft>> {
  return Object.fromEntries(
    fields.map((field) => {
      const matchingEventField = eventFields.find((candidate) => candidate.path === field.name);
      return [
        field.name,
        matchingEventField
          ? { kind: 'event', value: matchingEventField.path }
          : {
              kind: 'literal',
              value: createDefaultEventLiteralValue(field),
              authored: field.required,
            },
      ];
    }),
  );
}

/*** Parse one binding-editor text input according to declared bindable metadata for non-DataSchema literal surfaces. */
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
 * @utility @ankhorage/utility/json
 */
export function formatStudioBindingLiteral(value: BindingValue): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/***
 * Build a stable composite key from a multi-part operation identity.
 * @utility @ankhorage/utility/string
 */
export function createStudioOperationKey(operation: BindingOperationRef): string {
  const { apiId, endpointId, operationId } = operation;
  return `${apiId}::${endpointId ?? ''}::${operationId}`;
}

/***
 * Find the first array item whose projected composite key equals a requested key.
 * @utility @ankhorage/utility/array
 */
export function findStudioOperationByKey(
  operations: readonly StudioBindingOperationOption[],
  key: string,
): StudioBindingOperationOption | undefined {
  return operations.find((option) => createStudioOperationKey(option.operation) === key);
}

/*** Convert event-input drafts into the canonical binding input map while omitting untouched optional literals. */
function createStudioEventInputMap(
  fields: readonly StudioBindingInputFieldOption[],
  drafts: Readonly<Record<string, StudioEventInputDraft>>,
): BindingInputMap {
  return Object.fromEntries(
    fields.flatMap((field) => {
      const draft = drafts[field.name];
      if (!draft) return [];
      if (draft.kind === 'event') {
        if (!draft.value && !field.required) return [];
        return [
          [
            field.name,
            {
              kind: 'source' as const,
              source: { kind: 'event' as const, path: draft.value },
            },
          ],
        ];
      }
      if (!draft.authored && !field.required) return [];
      return [[field.name, { kind: 'literal' as const, value: draft.value }]];
    }),
  );
}

/*** Create a typed draft value from neutral Authoring Engine semantics when DataSchema authoring is available. */
function createDefaultEventLiteralValue(field: StudioBindingInputFieldOption): BindingValue {
  if (field.authoring?.ok) return createDefaultAuthoringValue(field.authoring.structure);
  return createDefaultBindingValue(field.value);
}

/*** Create one deterministic editor draft value without introducing a second DataSchema interpreter. */
function createDefaultAuthoringValue(structure: AuthoringStructure): BindingValue {
  switch (structure.kind) {
    case 'scalar':
      if (structure.scalarType === 'boolean') return false;
      if (structure.scalarType === 'integer' || structure.scalarType === 'number') return 0;
      if (structure.scalarType === 'null') return null;
      return '';
    case 'choice':
      return structure.values[0] ?? '';
    case 'object':
      return Object.fromEntries(
        structure.fields
          .filter((field) => !field.optional)
          .map((field) => [field.name, createDefaultAuthoringValue(field.structure)] as const),
      );
    case 'ordered-list':
      return [];
    case 'set':
      return {};
    case 'unsupported':
      return createDefaultBindingValue({ type: 'unknown' });
  }
}

/*** Create the empty/default binding value associated with one Studio binding metadata type. */
function createDefaultBindingValue(meta: UiBindableValueMeta): BindingValue {
  if (meta.type === 'boolean') return false;
  if (meta.type === 'number') return 0;
  if (meta.type === 'array') return [];
  if (meta.type === 'object' || meta.type === 'record' || meta.type === 'imageAsset') return {};
  return '';
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
