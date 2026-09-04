import type {
  ApiDefinition,
  ApiDefinitionList,
  BindingOperationRef,
  DataOperationConfig,
  DataSchema,
  UiBindableValueMeta,
} from '@ankhorage/contracts';

import type {
  StudioBindingInputFieldOption,
  StudioBindingOperationOption,
} from './bindingAuthoringContracts';
import { collectStudioResponsePaths, resolveStudioSchemaValueMeta } from './bindingSchemaModel';

/***
 * Collect and alphabetically sort the API operations available for Studio binding authoring.
 * @todo Move binding operation catalog behavior under src/bindings/.
 */
export function collectStudioBindingOperationOptions(
  apis: ApiDefinitionList,
): readonly StudioBindingOperationOption[] {
  return apis
    .flatMap((api) => collectApiOperations(api))
    .sort((left, right) => left.label.localeCompare(right.label));
}

/***
 * Find an option whose compound API, endpoint, and operation identifiers match a reference.
 * @utility @ankhorage/utility/array
 */
export function findStudioBindingOperationOption(
  options: readonly StudioBindingOperationOption[],
  ref: BindingOperationRef,
): StudioBindingOperationOption | undefined {
  return options.find(
    (option) =>
      option.operation.apiId === ref.apiId &&
      option.operation.operationId === ref.operationId &&
      option.operation.endpointId === ref.endpointId,
  );
}

/***
 * Project all endpoint operations from one API definition into Studio binding options.
 * @todo Keep API-to-binding option projection under src/bindings/.
 */
function collectApiOperations(api: ApiDefinition): StudioBindingOperationOption[] {
  return Object.values(api.endpoints).flatMap((endpoint) =>
    Object.values(endpoint.operations).map((operation) => ({
      operation: {
        apiId: api.id,
        endpointId: endpoint.id,
        operationId: operation.id,
      },
      label: `${api.name ?? api.id} · ${operation.name ?? operation.id}`,
      apiLabel: describeApi(api),
      inputFields: collectOperationInputFields(api, operation),
      responsePaths: collectStudioResponsePaths(
        resolveSlotSchema(api, operation.response),
        api.schemas,
      ),
    })),
  );
}

/***
 * Collect request parameters and request-body properties as Studio binding input fields.
 * @todo Keep operation input-field projection under src/bindings/.
 */
function collectOperationInputFields(
  api: ApiDefinition,
  operation: DataOperationConfig,
): readonly StudioBindingInputFieldOption[] {
  const fields = new Map<string, StudioBindingInputFieldOption>();
  for (const parameter of operation.request?.parameters ?? []) {
    fields.set(parameter.name, {
      name: parameter.name,
      label: parameter.description ?? parameter.name,
      value: resolveStudioSchemaValueMeta(resolveSlotSchema(api, parameter), api.schemas),
      required: parameter.required ?? false,
    });
  }

  const requestSchema = resolveSlotSchema(api, operation.request);
  for (const [name, schema] of Object.entries(requestSchema?.properties ?? {})) {
    if (fields.has(name)) continue;
    fields.set(name, {
      name,
      label: schema.title ?? name,
      value: resolveStudioSchemaValueMeta(schema, api.schemas),
      required: requestSchema?.required?.includes(name) ?? false,
    });
  }

  return [...fields.values()];
}

/***
 * Resolve an inline schema or schema reference from an API operation slot.
 * @todo Move this reusable API-contract helper to @ankhorage/contracts beside API schema definitions.
 */
function resolveSlotSchema(
  api: ApiDefinition,
  slot: { readonly schema?: DataSchema; readonly schemaRef?: { readonly id: string } } | undefined,
): DataSchema | undefined {
  return slot?.schema ?? (slot?.schemaRef ? api.schemas?.[slot.schemaRef.id] : undefined);
}

/***
 * Format one API definition as a compact id, origin, and protocol label.
 * @todo Keep API-specific presentation formatting with the binding authoring owner.
 */
function describeApi(api: ApiDefinition): string {
  return `${api.id} · ${api.origin} · ${api.protocol}`;
}

/***
 * Convert an action payload schema into Studio binding input-field options.
 * @todo Move action binding-field projection under src/bindings/.
 */
export function createStudioActionInputFields(
  payloadSchema:
    | Readonly<
        Record<
          string,
          { readonly label: string; readonly type: string; readonly required?: boolean }
        >
      >
    | undefined,
): readonly StudioBindingInputFieldOption[] {
  return Object.entries(payloadSchema ?? {}).map(([name, field]) => ({
    name,
    label: field.label,
    value: { type: toBindableType(field.type) },
    required: field.required ?? false,
  }));
}

/***
 * Narrow an arbitrary payload type string to the primitive types supported by bindable values.
 * @todo Keep bindable-type semantics under src/bindings/.
 */
function toBindableType(type: string): UiBindableValueMeta['type'] {
  if (type === 'string' || type === 'number' || type === 'boolean' || type === 'object') {
    return type;
  }
  return 'unknown';
}
