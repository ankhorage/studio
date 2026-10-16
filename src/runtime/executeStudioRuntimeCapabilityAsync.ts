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
function findStudioRuntimeOwnerCapability(capability: string) {
  return [...EXPO_RUNTIME_CAPABILITIES, ...NAVIGATOR_CAPABILITIES, ...SURFACE_CAPABILITIES].find(
    (candidate) => candidate.id === capability,
  );
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
