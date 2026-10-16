import { CAPABILITIES as EXPO_RUNTIME_CAPABILITIES } from '@ankhorage/expo-runtime/capabilities';
import { executeExpoRuntimeCapabilityAsync } from '@ankhorage/expo-runtime/capability-bridge';
import type {
  RuntimeCapabilityExecutionResult,
  RuntimeCapabilityExecutor,
} from '@ankhorage/runtime';

/***
 * Execute the Expo-owned capability supported by the Studio runtime host.
 */
export const executeStudioRuntimeCapabilityAsync: RuntimeCapabilityExecutor = async ({
  capability,
  input,
}): Promise<RuntimeCapabilityExecutionResult> => {
  const expoCapability = EXPO_RUNTIME_CAPABILITIES.find((candidate) => candidate.id === capability);
  if (!expoCapability) return missingStudioRuntimeCapability(capability);

  await executeExpoRuntimeCapabilityAsync({
    alertImpl: globalThis.alert,
    capability: expoCapability,
    input,
  });
  return { data: null, ok: true };
};

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
