import type {
  BindingInputValue,
  ComponentDataBindingRegistry,
  DataSourceRegistry,
  EventBinding,
  PropBinding,
  UiBindableValueMeta,
  UiComponentMetaRegistry,
  UiNode,
} from '@ankhorage/contracts';
import { validateRuntimeBindingOperationRef } from '@ankhorage/runtime';

import type {
  StudioBindingDiagnostic,
  StudioBindingInputFieldOption,
  StudioBindingOperationOption,
} from './bindingAuthoringContracts';
import { findStudioBindingOperationOption } from './bindingOperationModel';
import { assessStudioBindingCompatibility } from './bindingSchemaModel';

export function diagnoseStudioComponentBindings(args: {
  readonly node: UiNode;
  readonly registry: ComponentDataBindingRegistry;
  readonly componentMeta: UiComponentMetaRegistry;
  readonly dataSources: DataSourceRegistry;
  readonly operations: readonly StudioBindingOperationOption[];
  readonly actionTypes: readonly string[];
}): readonly StudioBindingDiagnostic[] {
  const binding = args.registry[args.node.id];
  if (!binding) return [];
  const meta = args.componentMeta[args.node.type]?.bindings;
  if (!meta) {
    return [
      diagnostic('missing-binding-meta', 'This component exposes no canonical binding metadata.'),
    ];
  }

  return [
    ...Object.entries(binding.props ?? {}).flatMap(([name, prop]) =>
      diagnosePropBinding(name, prop, args),
    ),
    ...Object.entries(binding.events ?? {}).flatMap(([name, events]) =>
      events.flatMap((event, index) => diagnoseEventBinding(name, index, event, args)),
    ),
  ];
}

function diagnosePropBinding(
  name: string,
  binding: PropBinding,
  args: Parameters<typeof diagnoseStudioComponentBindings>[0],
): readonly StudioBindingDiagnostic[] {
  const propMeta = args.componentMeta[args.node.type]?.bindings?.props?.[name];
  if (!propMeta) {
    return [diagnostic('unknown-prop', `Property '${name}' is not bindable.`, `props.${name}`)];
  }
  if (binding.source.kind !== 'operation') return [];

  const runtimeDiagnostics = validateRuntimeBindingOperationRef(
    binding.source.operation,
    args.dataSources,
  );
  if (runtimeDiagnostics.length > 0) {
    return [
      {
        ...diagnostic(
          'missing-operation',
          runtimeDiagnostics[0]?.message ?? 'Operation is unavailable.',
          `props.${name}`,
        ),
        runtimeDiagnostics,
      },
    ];
  }

  const operation = findStudioBindingOperationOption(args.operations, binding.source.operation);
  const path = binding.source.path ?? '';
  const response = operation?.responsePaths.find((candidate) => candidate.path === path);
  if (!response) {
    return [
      diagnostic(
        'missing-response-path',
        `Response path '${path || '<response>'}' is unavailable.`,
        `props.${name}`,
      ),
    ];
  }

  const compatibility = assessStudioBindingCompatibility(propMeta.value, response.value);
  return compatibility === 'incompatible'
    ? [
        diagnostic(
          'incompatible-response',
          `Response '${response.label}' is incompatible with ${propMeta.value.type}.`,
          `props.${name}`,
        ),
      ]
    : [];
}

function diagnoseEventBinding(
  eventName: string,
  index: number,
  binding: EventBinding,
  args: Parameters<typeof diagnoseStudioComponentBindings>[0],
): readonly StudioBindingDiagnostic[] {
  const eventMeta = args.componentMeta[args.node.type]?.bindings?.events?.[eventName];
  const path = `events.${eventName}.${index}`;
  if (!eventMeta) {
    return [diagnostic('unknown-event', `Event '${eventName}' is not bindable.`, path)];
  }

  if (binding.target.kind === 'action') {
    return args.actionTypes.includes(binding.target.type)
      ? []
      : [diagnostic('missing-action', `Action '${binding.target.type}' is unavailable.`, path)];
  }

  const runtimeDiagnostics = validateRuntimeBindingOperationRef(
    binding.target.operation,
    args.dataSources,
  );
  if (runtimeDiagnostics.length > 0) {
    return [
      {
        ...diagnostic(
          'missing-operation',
          runtimeDiagnostics[0]?.message ?? 'Operation is unavailable.',
          path,
        ),
        runtimeDiagnostics,
      },
    ];
  }

  const operation = findStudioBindingOperationOption(args.operations, binding.target.operation);
  return diagnoseEventInputs(
    binding,
    operation?.inputFields ?? [],
    eventMeta.payload?.fields ?? [],
    path,
  );
}

function diagnoseEventInputs(
  binding: EventBinding,
  fields: readonly StudioBindingInputFieldOption[],
  eventFields: readonly { readonly path: string; readonly type: string }[],
  path: string,
): readonly StudioBindingDiagnostic[] {
  return fields.flatMap((field) => {
    const input = binding.input?.[field.name];
    if (!input) {
      return field.required
        ? [
            diagnostic(
              'missing-input',
              `Required input '${field.name}' is not mapped.`,
              `${path}.input.${field.name}`,
            ),
          ]
        : [];
    }
    return diagnoseInputCompatibility(input, field, eventFields, `${path}.input.${field.name}`);
  });
}

function diagnoseInputCompatibility(
  input: BindingInputValue,
  field: StudioBindingInputFieldOption,
  eventFields: readonly { readonly path: string; readonly type: string }[],
  path: string,
): readonly StudioBindingDiagnostic[] {
  if (input.kind !== 'source' || input.source.kind !== 'event') return [];
  const eventValue = resolveEventSourceValue(input.source.path, eventFields);
  if (!eventValue) {
    return [
      diagnostic('incompatible-input', `Event path '${input.source.path}' is unavailable.`, path),
    ];
  }
  const compatibility = assessStudioBindingCompatibility(field.value, eventValue);
  return compatibility === 'incompatible'
    ? [
        diagnostic(
          'incompatible-input',
          `Event path '${input.source.path}' is incompatible with ${field.value.type}.`,
          path,
        ),
      ]
    : [];
}

function resolveEventSourceValue(
  path: string,
  eventFields: readonly { readonly path: string; readonly type: string }[],
): UiBindableValueMeta | undefined {
  const exact = eventFields.find((candidate) => candidate.path === path);
  if (exact) return { type: toBindableType(exact.type) };

  const parent = eventFields.find(
    (candidate) =>
      path.startsWith(`${candidate.path}.`) &&
      (candidate.type === 'object' || candidate.type === 'record' || candidate.type === 'unknown'),
  );
  return parent ? { type: 'unknown' } : undefined;
}

function toBindableType(type: string): UiBindableValueMeta['type'] {
  if (
    type === 'string' ||
    type === 'number' ||
    type === 'boolean' ||
    type === 'object' ||
    type === 'record'
  ) {
    return type;
  }
  return 'unknown';
}

function diagnostic(
  code: StudioBindingDiagnostic['code'],
  message: string,
  path?: string,
): StudioBindingDiagnostic {
  return { code, message, severity: 'error', ...(path ? { path } : {}) };
}
