import type {
  BindingInputValue,
  BindingOperationRef,
  ComponentDataBindingRegistry,
  EventBinding,
  PropBinding,
  UiBindableValueMeta,
  UiComponentMetaRegistry,
  UiNode,
} from '@ankhorage/contracts';

import type {
  StudioBindingDiagnostic,
  StudioBindingInputFieldOption,
  StudioBindingOperationOption,
} from './bindingAuthoringContracts';
import { findStudioBindingOperationOption } from './bindingOperationModel';
import { assessStudioBindingCompatibility } from './bindingSchemaModel';
import { readOwnProperty } from './utils/readOwnProperty';

/***
 * Diagnose all authored prop and event bindings for one Studio component node.
 * @todo Move binding diagnostics under src/bindings/.
 */
export function diagnoseStudioComponentBindings(args: {
  readonly node: UiNode;
  readonly registry: ComponentDataBindingRegistry;
  readonly componentMeta: UiComponentMetaRegistry;
  readonly operations: readonly StudioBindingOperationOption[];
  readonly actionTypes: readonly string[];
}): readonly StudioBindingDiagnostic[] {
  const binding = readOwnProperty<ComponentDataBindingRegistry[string]>(
    args.registry,
    args.node.id,
  );
  if (!binding) return [];
  const meta = readOwnProperty<UiComponentMetaRegistry[string]>(
    args.componentMeta,
    args.node.type,
  )?.bindings;
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

/***
 * Diagnose one prop binding against component metadata and the selected operation response path.
 * @todo Keep prop-binding diagnostics under src/bindings/.
 */
function diagnosePropBinding(
  name: string,
  binding: PropBinding,
  args: Parameters<typeof diagnoseStudioComponentBindings>[0],
): readonly StudioBindingDiagnostic[] {
  const props = readOwnProperty<UiComponentMetaRegistry[string]>(args.componentMeta, args.node.type)
    ?.bindings?.props;
  const propMeta = props ? Object.entries(props).find(([key]) => key === name)?.[1] : undefined;
  if (!propMeta) {
    return [diagnostic('unknown-prop', `Property '${name}' is not bindable.`, `props.${name}`)];
  }
  if (binding.source.kind !== 'operation') return [];

  const operation = findStudioBindingOperationOption(args.operations, binding.source.operation);
  if (!operation) {
    return [missingOperationDiagnostic(binding.source.operation, `props.${name}`)];
  }

  const path = binding.source.path ?? '';
  const response = operation.responsePaths.find((candidate) => candidate.path === path);
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

/***
 * Diagnose one indexed event binding against event metadata, actions, operation availability, and inputs.
 * @todo Keep event-binding diagnostics under src/bindings/.
 */
function diagnoseEventBinding(
  eventName: string,
  index: number,
  binding: EventBinding,
  args: Parameters<typeof diagnoseStudioComponentBindings>[0],
): readonly StudioBindingDiagnostic[] {
  const events = readOwnProperty<UiComponentMetaRegistry[string]>(
    args.componentMeta,
    args.node.type,
  )?.bindings?.events;
  const eventMeta = events
    ? Object.entries(events).find(([key]) => key === eventName)?.[1]
    : undefined;
  const path = `events.${eventName}.${index}`;
  if (!eventMeta) {
    return [diagnostic('unknown-event', `Event '${eventName}' is not bindable.`, path)];
  }

  if (binding.target.kind === 'action') {
    return args.actionTypes.includes(binding.target.type)
      ? []
      : [diagnostic('missing-action', `Action '${binding.target.type}' is unavailable.`, path)];
  }

  const operation = findStudioBindingOperationOption(args.operations, binding.target.operation);
  if (!operation) {
    return [missingOperationDiagnostic(binding.target.operation, path)];
  }

  return diagnoseEventInputs(binding, operation.inputFields, eventMeta.payload?.fields ?? [], path);
}

/***
 * Diagnose required and mapped inputs for one event-to-operation binding.
 * @todo Keep event input diagnostics under src/bindings/.
 */
function diagnoseEventInputs(
  binding: EventBinding,
  fields: readonly StudioBindingInputFieldOption[],
  eventFields: readonly { readonly path: string; readonly type: string }[],
  path: string,
): readonly StudioBindingDiagnostic[] {
  return fields.flatMap((field) => {
    const input = binding.input
      ? readOwnProperty<BindingInputValue>(binding.input, field.name)
      : undefined;
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

/***
 * Diagnose one event-source input against the expected operation input field.
 * @todo Keep input compatibility diagnostics under src/bindings/.
 */
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

/***
 * Resolve an exact or object-parent event field path into bindable value metadata.
 * @todo Keep event-payload path semantics under src/bindings/.
 */
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

/***
 * Create the Studio diagnostic used when a referenced API operation cannot be resolved.
 * @todo Keep missing-operation diagnostics under src/bindings/.
 */
function missingOperationDiagnostic(
  operation: BindingOperationRef,
  path: string,
): StudioBindingDiagnostic {
  const ref = [operation.apiId, operation.endpointId, operation.operationId]
    .filter((part): part is string => part !== undefined)
    .join(' · ');
  return diagnostic('missing-operation', `Operation '${ref}' is unavailable.`, path);
}

/***
 * Narrow an event payload type string to the bindable primitive types supported by Studio.
 * @todo Deduplicate bindable-type normalization within src/bindings/.
 */
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

/***
 * Construct an error diagnostic from a code, message, and optional path.
 * @utility @ankhorage/utility/diagnostics
 */
function diagnostic(
  code: StudioBindingDiagnostic['code'],
  message: string,
  path?: string,
): StudioBindingDiagnostic {
  return { code, message, severity: 'error', ...(path ? { path } : {}) };
}
