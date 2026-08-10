import type {
  BindingOperationRef,
  DataOperationConfig,
  DataSchema,
  DataSourceConfig,
  DataSourceRegistry,
  UiBindableValueMeta,
} from '@ankhorage/contracts';

import type {
  StudioBindingInputFieldOption,
  StudioBindingOperationOption,
} from './bindingAuthoringContracts';
import { collectStudioResponsePaths, resolveStudioSchemaValueMeta } from './bindingSchemaModel';

export function collectStudioBindingOperationOptions(
  dataSources: DataSourceRegistry,
): readonly StudioBindingOperationOption[] {
  return Object.values(dataSources)
    .flatMap((source) => collectSourceOperations(source))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function findStudioBindingOperationOption(
  options: readonly StudioBindingOperationOption[],
  ref: BindingOperationRef,
): StudioBindingOperationOption | undefined {
  return options.find(
    (option) =>
      option.operation.dataSourceId === ref.dataSourceId &&
      option.operation.operationId === ref.operationId &&
      option.operation.endpointId === ref.endpointId,
  );
}

function collectSourceOperations(source: DataSourceConfig): StudioBindingOperationOption[] {
  return Object.values(source.endpoints).flatMap((endpoint) =>
    Object.values(endpoint.operations).map((operation) => ({
      operation: {
        dataSourceId: source.id,
        endpointId: endpoint.id,
        operationId: operation.id,
      },
      label: `${source.name ?? source.id} · ${operation.name ?? operation.id}`,
      sourceLabel: describeSource(source),
      inputFields: collectOperationInputFields(source, operation),
      responsePaths: collectStudioResponsePaths(
        resolveSlotSchema(source, operation.response),
        source.schemas,
      ),
    })),
  );
}

function collectOperationInputFields(
  source: DataSourceConfig,
  operation: DataOperationConfig,
): readonly StudioBindingInputFieldOption[] {
  const fields = new Map<string, StudioBindingInputFieldOption>();
  for (const parameter of operation.request?.parameters ?? []) {
    fields.set(parameter.name, {
      name: parameter.name,
      label: parameter.description ?? parameter.name,
      value: resolveStudioSchemaValueMeta(resolveSlotSchema(source, parameter), source.schemas),
      required: parameter.required ?? false,
    });
  }

  const requestSchema = resolveSlotSchema(source, operation.request);
  for (const [name, schema] of Object.entries(requestSchema?.properties ?? {})) {
    if (fields.has(name)) continue;
    fields.set(name, {
      name,
      label: schema.title ?? name,
      value: resolveStudioSchemaValueMeta(schema, source.schemas),
      required: requestSchema?.required?.includes(name) ?? false,
    });
  }

  return [...fields.values()];
}

function resolveSlotSchema(
  source: DataSourceConfig,
  slot: { readonly schema?: DataSchema; readonly schemaRef?: { readonly id: string } } | undefined,
): DataSchema | undefined {
  return slot?.schema ?? (slot?.schemaRef ? source.schemas?.[slot.schemaRef.id] : undefined);
}

function describeSource(source: DataSourceConfig): string {
  if (source.kind === 'database') return `${source.id} · database`;
  return `${source.id} · ${source.origin} · ${source.protocol}`;
}

export function createStudioActionInputFields(
  payloadSchema: Readonly<Record<string, { readonly label: string; readonly type: string; readonly required?: boolean }>> | undefined,
): readonly StudioBindingInputFieldOption[] {
  return Object.entries(payloadSchema ?? {}).map(([name, field]) => ({
    name,
    label: field.label,
    value: { type: toBindableType(field.type) },
    required: field.required ?? false,
  }));
}

function toBindableType(type: string): UiBindableValueMeta['type'] {
  if (type === 'string' || type === 'number' || type === 'boolean' || type === 'object') return type;
  return 'unknown';
}
