import type {
  ApmExtensionEvidence,
  ApmStatusExtensionEvidencePort,
} from '@ankhorage/apm/types';

import { inspectPendingModuleLifecycleEvidenceAsync } from '../adapters/outbound/inspectPendingModuleLifecycleEvidenceAsync';

/*** Compose Studio pending-lifecycle evidence with any existing package-owner status provider. */
export function createStudioProjectUpdateExtensionEvidencePort(
  base?: ApmStatusExtensionEvidencePort,
): ApmStatusExtensionEvidencePort {
  return {
    inspectExtensionEvidenceAsync: async (input) => {
      const [baseEvidence, pendingEvidence] = await Promise.all([
        readBaseEvidenceAsync(base, input),
        inspectPendingModuleLifecycleEvidenceAsync(input.rootPath),
      ]);
      return mergeExtensionEvidence(baseEvidence, pendingEvidence);
    },
  };
}

/*** Read optional existing owner evidence without treating an absent provider as incomplete. */
async function readBaseEvidenceAsync(
  base: ApmStatusExtensionEvidencePort | undefined,
  input: Parameters<ApmStatusExtensionEvidencePort['inspectExtensionEvidenceAsync']>[0],
): Promise<ApmExtensionEvidence> {
  return base === undefined
    ? { state: 'unavailable', complete: true, observations: [], diagnostics: [] }
    : base.inspectExtensionEvidenceAsync(input);
}

/*** Merge independent owner evidence without replacing an already composed provider. */
function mergeExtensionEvidence(
  base: ApmExtensionEvidence,
  pending: ApmExtensionEvidence,
): ApmExtensionEvidence {
  return {
    state: base.state === 'available' || pending.state === 'available' ? 'available' : 'unavailable',
    complete: base.complete && pending.complete,
    observations: [...base.observations, ...pending.observations],
    diagnostics: [...base.diagnostics, ...pending.diagnostics],
  };
}
