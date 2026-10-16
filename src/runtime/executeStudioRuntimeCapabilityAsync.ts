import { CAPABILITIES as EXPO_RUNTIME_CAPABILITIES } from '@ankhorage/expo-runtime/capabilities';
import type {
  ExpoRuntimeCapabilityHandler,
  ExpoRuntimeCapabilityHandlerArgs,
} from '@ankhorage/expo-runtime/capability-bridge';
import { executeExpoRuntimeCapabilityAsync } from '@ankhorage/expo-runtime/capability-bridge';
import { CAPABILITIES as NAVIGATOR_CAPABILITIES } from '@ankhorage/navigator/capabilities';
import type {
  RuntimeCapabilityExecutionResult,
  RuntimeCapabilityExecutor,
} from '@ankhorage/runtime';
import { CAPABILITIES as SURFACE_CAPABILITIES } from '@ankhorage/surface/capabilities';

type StudioRuntimeHostCapability =
  | (typeof NAVIGATOR_CAPABILITIES)[number]
  | (typeof SURFACE_CAPABILITIES)[number]
  | (typeof EXPO_RUNTIME_CAPABILITIES)[number];

export interface StudioRuntimeCapabilityHost {
  readonly alert?: (message: string) => void;
  readonly navigate?: (input: unknown) => void;
  readonly setThemeMode?: (input: unknown) => void;
}

/***
 * Create the Runtime 5 executor that delegates published owner descriptors to Studio host handlers.
 */
export function createStudioRuntimeCapabilityExecutor(
  host: StudioRuntimeCapabilityHost,
): RuntimeCapabilityExecutor {
  return async ({ capability, input }): Promise<RuntimeCapabilityExecutionResult> => {
    const ownerCapability = findStudioRuntimeOwnerCapability(capability);
    if (!ownerCapability) return missingStudioRuntimeCapability(capability);
    if (!isStudioRuntimeHostInputValid(ownerCapability, input)) {
      return invalidStudioRuntimeHostInput(ownerCapability.id);
    }

    const result = await executeExpoRuntimeCapabilityAsync({
      alertImpl: host.alert,
      capability: ownerCapability,
      capabilityHandlers: createStudioRuntimeCapabilityHandlers(host),
      input,
    });

    return result.ok
      ? { data: null, ok: true }
      : {
          diagnostics: result.diagnostics.map((diagnostic) => ({
            ...diagnostic,
            severity: 'error' as const,
          })),
          ok: false,
        };
  };
}

/*** Execute a published owner capability through the default global Studio alert host. */
export const executeStudioRuntimeCapabilityAsync: RuntimeCapabilityExecutor =
  createStudioRuntimeCapabilityExecutor({ alert: globalThis.alert });

/*** Resolve a capability descriptor from its published Expo Runtime, Navigator, or Surface owner. */
function findStudioRuntimeOwnerCapability(
  capability: string,
): StudioRuntimeHostCapability | undefined {
  return [...EXPO_RUNTIME_CAPABILITIES, ...NAVIGATOR_CAPABILITIES, ...SURFACE_CAPABILITIES].find(
    (candidate) => candidate.id === capability,
  );
}

/*** Validate the two non-Expo host inputs against their published owner capability schemas. */
function isStudioRuntimeHostInputValid(
  capability: StudioRuntimeHostCapability,
  input: unknown,
): boolean {
  if (capability.id === 'navigator.navigate') return isNavigatorNavigateInput(input);
  if (capability.id === 'theme.setMode') return isThemeSetModeInput(input);
  return true;
}

/*** Validate Navigator's published `navigator.navigate` object schema before the Router host runs. */
function isNavigatorNavigateInput(input: unknown): boolean {
  if (!isPlainRecord(input) || typeof input.route !== 'string') return false;
  return input.params === undefined || isPlainRecord(input.params);
}

/*** Validate Surface's published `theme.setMode` object schema before the theme host runs. */
function isThemeSetModeInput(input: unknown): boolean {
  return (
    isPlainRecord(input) &&
    Object.keys(input).length === 1 &&
    (input.mode === 'dark' || input.mode === 'light')
  );
}

/*** Identify serializable object input without accepting arrays or inherited host values. */
function isPlainRecord(input: unknown): input is Readonly<Record<string, unknown>> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

/*** Create the Expo Runtime handler list from the concrete Studio host callbacks that are available. */
function createStudioRuntimeCapabilityHandlers(
  host: StudioRuntimeCapabilityHost,
): readonly ExpoRuntimeCapabilityHandler[] {
  return [
    ...(host.navigate === undefined
      ? []
      : [
          {
            capabilityId: 'navigator.navigate' as const,
            execute: ({ input }: ExpoRuntimeCapabilityHandlerArgs) => host.navigate?.(input),
          },
        ]),
    ...(host.setThemeMode === undefined
      ? []
      : [
          {
            capabilityId: 'theme.setMode' as const,
            execute: ({ input }: ExpoRuntimeCapabilityHandlerArgs) => host.setThemeMode?.(input),
          },
        ]),
  ];
}

/*** Report a capability that has no Studio runtime-host executor. */
function missingStudioRuntimeCapability(capability: string): RuntimeCapabilityExecutionResult {
  return {
    diagnostics: [
      {
        code: 'missing-operation',
        message: `Capability '${capability}' has no Studio runtime-host executor.`,
        severity: 'error',
      },
    ],
    ok: false,
  };
}

/*** Report input rejected at the published Navigator or Surface schema boundary. */
function invalidStudioRuntimeHostInput(capability: string): RuntimeCapabilityExecutionResult {
  return {
    diagnostics: [
      {
        code: 'invalid-capability-input',
        message: `Capability '${capability}' received input that does not satisfy its published owner schema.`,
        severity: 'error',
      },
    ],
    ok: false,
  };
}
