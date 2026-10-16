import type { RuntimeCapabilityExecutor } from '@ankhorage/runtime';
import { useCallback } from 'react';

import { executeStudioRuntimeCapabilityAsync } from './executeStudioRuntimeCapabilityAsync.js';

/***
 * Expose Studio's runtime-host capability executor to generated Studio applications.
 */
export function useStudioRuntimeCapabilityExecutor() {
  const executeCapability = useCallback<RuntimeCapabilityExecutor>(
    (args) => executeStudioRuntimeCapabilityAsync(args),
    [],
  );

  return { executeCapability };
}
