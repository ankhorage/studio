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

export interface StudioEventInputDraft {
  readonly kind: StudioEventInputSourceKind;
  readonly value: string;
}

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
          : { kind: 'literal', value: '' },
      ];
    }),
  );
}

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

export function formatStudioBindingLiteral(value: BindingValue): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export function createStudioOperationKey(operation: BindingOperationRef): string {
  const { apiId, endpointId, operationId } = operation;
  return `${apiId}::${endpointId ?? ''}::${operationId}`;
}

export function findStudioOperationByKey(
  operations: readonly StudioBindingOperationOption[],
  key: string,
): StudioBindingOperationOption | undefined {
  return operations.find((option) => createStudioOperationKey(option.operation) === key);
}

function createStudioEventInputMap(
  fields: readonly StudioBindingInputFieldOption[],
  drafts: Readonly<Record<string, StudioEventInputDraft>>,
): BindingInputMap {
  return Object.fromEntries(
    fields.flatMap((field) => {
      const draft = drafts[field.name];
      if (!draft || (!draft.value && !field.required)) return [];
      return [
        [
          field.name,
          draft.kind === 'event'
            ? { kind: 'source' as const, source: { kind: 'event' as const, path: draft.value } }
            : {
                kind: 'literal' as const,
                value: parseStudioBindingLiteral(draft.value, field.value),
              },
        ],
      ];
    }),
  );
}

function createDefaultBindingValue(meta: UiBindableValueMeta): BindingValue {
  if (meta.type === 'boolean') return false;
  if (meta.type === 'number') return 0;
  if (meta.type === 'array') return [];
  if (meta.type === 'object' || meta.type === 'record' || meta.type === 'imageAsset') return {};
  return '';
}

function parseStructuredValue(input: string, fallback: BindingValue): BindingValue {
  try {
    const value: unknown = JSON.parse(input);
    return isBindingValue(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function isBindingValue(value: unknown): value is BindingValue {
  if (value === null) return true;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return true;
  }
  if (Array.isArray(value)) return value.every(isBindingValue);
  if (typeof value !== 'object') return false;
  return Object.values(value as Record<string, unknown>).every(isBindingValue);
}
