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

export function collectStudioBindingOperationOptions(
  apis: ApiDefinitionList,
): readonly StudioBindingOperationOption[] {
  return apis
    .flatMap((api) => collectApiOperations(api))
    .sort((left, right) => left.label.localeCompare(right.label));
}

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
      responsePaths: collectStudioResponsePaths(resolveSlotSchema(api, operation.response), api.schemas),
    })),
  );
}

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

function resolveSlotSchema(
  api: ApiDefinition,
  slot: { readonly schema?: DataSchema; readonly schemaRef?: { readonly id: string } } | undefined,
): DataSchema | undefined {
  return slot?.schema ?? (slot?.schemaRef ? api.schemas?.[slot.schemaRef.id] : undefined);
}

function describeApi(api: ApiDefinition): string {
  return `${api.id} · ${api.origin} · ${api.protocol}`;
}

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

function toBindableType(type: string): UiBindableValueMeta['type'] {
  if (type === 'string' || type === 'number' || type === 'boolean' || type === 'object') {
    return type;
  }
  return 'unknown';
}
