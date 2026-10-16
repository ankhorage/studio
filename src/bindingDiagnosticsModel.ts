import type {
  BindingExpression,
  ComponentDataBindingRegistry,
  EventBinding,
  PropBinding,
  UiBindableEventMeta,
  UiBindableValueMeta,
  UiComponentMetaRegistry,
  UiNode,
} from '@ankhorage/contracts';
import { createDiagnostic } from '@ankhorage/utility/diagnostics';
import { readOwnProperty } from '@ankhorage/utility/object';

import type {
  StudioBindingDiagnostic,
  StudioBindingInputFieldOption,
  StudioBindingCapabilityOption,
} from './bindingAuthoringContracts';
import { findStudioBindingCapabilityOption } from './bindingOperationModel';
import { assessStudioBindingCompatibility } from './bindingSchemaModel';

/***
 * Diagnose all authored prop and event bindings for one Studio component node.
 * Follow-up: Move binding diagnostics under src/bindings/.
 */
export function diagnoseStudioComponentBindings(args: {
  readonly node: UiNode;
  readonly registry: ComponentDataBindingRegistry;
  readonly componentMeta: UiComponentMetaRegistry;
  readonly capabilities: readonly StudioBindingCapabilityOption[];
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
 * Follow-up: Keep prop-binding diagnostics under src/bindings/.
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
  if (!isCapabilityReference(binding.value)) return [];
  if (isRuntimeValueReference(binding.value.capability)) return [];

  const capability = findStudioBindingCapabilityOption(args.capabilities, binding.value.capability);
  if (!capability) {
    return [missingCapabilityDiagnostic(binding.value.capability, `props.${name}`)];
  }

  const path = binding.value.path ?? '';
  const response = capability.responsePaths.find((candidate) => candidate.path === path);
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
 * Follow-up: Keep event-binding diagnostics under src/bindings/.
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

  const capability = findStudioBindingCapabilityOption(
    args.capabilities,
    binding.target.capability,
  );
  if (!capability) {
    return [missingCapabilityDiagnostic(binding.target.capability, path)];
  }

  return diagnoseEventInputs(binding, capability.inputFields, eventMeta, path);
}

/***
 * Diagnose required and mapped inputs for one event-to-operation binding.
 * Follow-up: Keep event input diagnostics under src/bindings/.
 */
function diagnoseEventInputs(
  binding: EventBinding,
  fields: readonly StudioBindingInputFieldOption[],
  eventMeta: UiBindableEventMeta,
  path: string,
): readonly StudioBindingDiagnostic[] {
  return fields.flatMap((field) => {
    const input = binding.target.input
      ? readOwnProperty<BindingExpression>(binding.target.input, field.name)
      : undefined;
    if (!input) {
      return field.required
        ? [
            diagnostic(
              'missing-input',
              `Required input '${field.name}' is not mapped.`,
              `${path}.target.input.${field.name}`,
            ),
          ]
        : [];
    }
    return diagnoseInputCompatibility(
      input,
      field,
      eventMeta,
      `${path}.target.input.${field.name}`,
    );
  });
}

/***
 * Diagnose one event-source input against the expected operation input field.
 * Follow-up: Keep input compatibility diagnostics under src/bindings/.
 */
function diagnoseInputCompatibility(
  input: BindingExpression,
  field: StudioBindingInputFieldOption,
  eventMeta: UiBindableEventMeta,
  path: string,
): readonly StudioBindingDiagnostic[] {
  const eventReference = unwrapEventCapabilityReference(input);
  if (!eventReference) return [];
  if (eventReference.capability !== eventMeta.payload?.eventType) {
    return [
      diagnostic(
        'incompatible-input',
        `Event capability '${eventReference.capability}' does not match '${eventMeta.payload?.eventType ?? '<none>'}'.`,
        path,
      ),
    ];
  }
  const eventValue = resolveEventSourceValue(
    eventReference.path ?? '',
    eventMeta.payload?.fields ?? [],
  );
  if (!eventValue) {
    return [
      diagnostic(
        'incompatible-input',
        `Event path '${eventReference.path ?? ''}' is unavailable.`,
        path,
      ),
    ];
  }
  const compatibility = assessStudioBindingCompatibility(field.value, eventValue);
  return compatibility === 'incompatible'
    ? [
        diagnostic(
          'incompatible-input',
          `Event path '${eventReference.path ?? ''}' is incompatible with ${field.value.type}.`,
          path,
        ),
      ]
    : [];
}

/***
 * Resolve an exact or object-parent event field path into bindable value metadata.
 * Follow-up: Keep event-payload path semantics under src/bindings/.
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
 * Create the Studio diagnostic used when a referenced capability cannot be resolved.
 */
function missingCapabilityDiagnostic(capability: string, path: string): StudioBindingDiagnostic {
  return diagnostic('missing-capability', `Capability '${capability}' is unavailable.`, path);
}

/*** Recognize an untransformed capability reference expression. */
function isCapabilityReference(
  expression: BindingExpression,
): expression is Extract<BindingExpression, { readonly capability: string }> {
  return 'capability' in expression;
}

/*** Recognize property-value references resolved by the generated runtime rather than executable capabilities. */
function isRuntimeValueReference(capability: string): boolean {
  return capability.startsWith('state.') || capability.startsWith('context.');
}

/*** Unwrap the event reference preserved by the binding editor through optional transforms. */
function unwrapEventCapabilityReference(
  expression: BindingExpression,
): Extract<BindingExpression, { readonly capability: string }> | null {
  if (isCapabilityReference(expression)) return expression;
  return expression.kind === 'transform' && isCapabilityReference(expression.value)
    ? expression.value
    : null;
}

/***
 * Narrow an event payload type string to the bindable primitive types supported by Studio.
 * Follow-up: Deduplicate bindable-type normalization within src/bindings/.
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
 */
function diagnostic(
  code: StudioBindingDiagnostic['code'],
  message: string,
  path?: string,
): StudioBindingDiagnostic {
  return { ...createDiagnostic(code, message, 'error'), ...(path ? { path } : {}) };
}
