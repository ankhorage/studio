import type {
  ApiDefinition,
  ApiDefinitionRegistry,
  DataOperationConfig,
  DataSchema,
} from '@ankhorage/contracts';
import type { Capability } from '@ankhorage/contracts/capability';
import { CAPABILITIES as EXPO_RUNTIME_CAPABILITIES } from '@ankhorage/expo-runtime/capabilities';
import { CAPABILITIES as NAVIGATOR_CAPABILITIES } from '@ankhorage/navigator/capabilities';
import { CAPABILITIES as SURFACE_CAPABILITIES } from '@ankhorage/surface/capabilities';
import { findByKey } from '@ankhorage/utility/array';
import { readOwnProperty } from '@ankhorage/utility/object';

import type {
  StudioBindingCapabilityOption,
  StudioBindingInputFieldOption,
} from './bindingAuthoringContracts';
import { collectStudioResponsePaths, resolveStudioSchemaValueMeta } from './bindingSchemaModel';
import { resolveDataSchemaAuthoringStructure } from './features/authoring-engine/adapters/outbound/resolveDataSchemaAuthoringStructure';

const STUDIO_HOSTED_CAPABILITY_IDS = [
  'navigator.navigate',
  'expo.alert',
  'theme.setMode',
] as const satisfies readonly Capability['id'][];

/***
 * Collect and alphabetically sort the API operations available for Studio binding authoring.
 * TODO: Move binding operation catalog behavior under src/bindings/.
 */
export function collectStudioBindingCapabilityOptions(
  apis: ApiDefinitionRegistry,
): readonly StudioBindingCapabilityOption[] {
  return [
    ...collectStudioStaticBindingCapabilities(),
    ...Object.values(apis).flatMap((api) => collectApiOperations(api)),
  ].sort((left, right) => left.label.localeCompare(right.label));
}

/***
 * Find an option through the canonical keyed array lookup utility.
 */
export function findStudioBindingCapabilityOption(
  options: readonly StudioBindingCapabilityOption[],
  capability: Capability['id'],
): StudioBindingCapabilityOption | undefined {
  return findByKey(options, capability, (option) => option.capability.id);
}

/***
 * Project all endpoint operations from one API definition into Studio binding options.
 * TODO: Keep API-to-binding option projection under src/bindings/.
 */
function collectApiOperations(api: ApiDefinition): StudioBindingCapabilityOption[] {
  return Object.values(api.endpoints).flatMap((endpoint) =>
    Object.values(endpoint.operations).map((operation) => ({
      capability: {
        id: `api.${api.id}.${operation.id}`,
        owner: '@ankhorage/runtime',
        access: ['invoke'],
        binding: { kind: 'api', bindableAs: ['source', 'target'] },
        input: operation.request,
        output: operation.response,
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

/*** Collect the released capabilities hosted by the generated Studio runtime. */
function collectStudioStaticBindingCapabilities(): readonly StudioBindingCapabilityOption[] {
  return [...NAVIGATOR_CAPABILITIES, ...EXPO_RUNTIME_CAPABILITIES, ...SURFACE_CAPABILITIES]
    .filter(isStudioHostedCapability)
    .map((capability) => ({
      capability,
      label: capability.id,
      apiLabel: capability.owner,
      inputFields: collectCapabilityInputFields(capability),
      responsePaths: [],
    }));
}

/*** Project a released capability's declared object input into Studio authoring fields. */
function collectCapabilityInputFields(
  capability: Capability,
): readonly StudioBindingInputFieldOption[] {
  const schema = capability.input?.schema;
  if (schema?.type !== 'object') return [];
  return Object.entries(schema.properties ?? {}).map(([name, field]) => ({
    name,
    label: field.title ?? name,
    value: resolveStudioSchemaValueMeta(field, undefined),
    required: schema.required?.includes(name) ?? false,
  }));
}

/*** Restrict released catalogs to the capability executors hosted by the generated Studio app. */
function isStudioHostedCapability(capability: Capability): boolean {
  return STUDIO_HOSTED_CAPABILITY_IDS.some((id) => id === capability.id);
}

/***
 * Collect request parameters and request-body properties as Studio binding input fields.
 * TODO: Keep operation input-field projection under src/bindings/.
 */
function collectOperationInputFields(
  api: ApiDefinition,
  operation: DataOperationConfig,
): readonly StudioBindingInputFieldOption[] {
  const fields = new Map<string, StudioBindingInputFieldOption>();
  for (const parameter of operation.request?.parameters ?? []) {
    const schema = resolveSlotSchema(api, parameter);
    fields.set(parameter.name, {
      name: parameter.name,
      label: parameter.description ?? parameter.name,
      value: resolveStudioSchemaValueMeta(schema, api.schemas),
      authoring: resolveDataSchemaAuthoringStructure(schema, api.schemas),
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
      authoring: resolveDataSchemaAuthoringStructure(schema, api.schemas),
      required: requestSchema?.required?.includes(name) ?? false,
    });
  }

  return [...fields.values()];
}

/***
 * Resolve an inline schema or schema reference from an API operation slot.
 * TODO: Move this reusable API-contract helper to @ankhorage/contracts beside API schema definitions.
 */
function resolveSlotSchema(
  api: ApiDefinition,
  slot: { readonly schema?: DataSchema; readonly schemaRef?: { readonly id: string } } | undefined,
): DataSchema | undefined {
  return (
    slot?.schema ??
    (slot?.schemaRef && api.schemas
      ? readOwnProperty<DataSchema>(api.schemas, slot.schemaRef.id)
      : undefined)
  );
}

/***
 * Format one API definition as a compact id, origin, and protocol label.
 * TODO: Keep API-specific presentation formatting with the binding authoring owner.
 */
function describeApi(api: ApiDefinition): string {
  return `${api.id} · ${api.origin} · ${api.protocol}`;
}
