import type { ApmExtensionEvidence } from '@ankhorage/apm/types';

import {
  STUDIO_PENDING_MODULE_LIFECYCLE_EVIDENCE,
  STUDIO_PENDING_MODULE_LIFECYCLE_FILE,
  STUDIO_PENDING_MODULE_LIFECYCLE_PROJECTION_ID,
} from '../../constants';
import { pendingModuleLifecycleIds } from '../../domain/pendingModuleLifecycleState';
import { readPendingModuleLifecycleStateAsync } from './readPendingModuleLifecycleStateAsync';

/*** Inspect Studio's deferred module removals without mutating or executing the project. */
export async function inspectPendingModuleLifecycleEvidenceAsync(
  rootPath: string,
): Promise<ApmExtensionEvidence> {
  const result = await readPendingModuleLifecycleStateAsync(rootPath);
  switch (result.state) {
    case 'absent':
      return availableEvidence([], undefined);
    case 'valid':
      return availableEvidence(pendingModuleLifecycleIds(result.value), result.digest);
    case 'invalid':
      return malformedEvidence(result.digest);
    case 'unreadable':
      return unreadableEvidence(result.reason);
  }
}

/*** Return complete Studio extension evidence for absent, empty, or valid pending state. */
function availableEvidence(
  moduleIds: readonly string[],
  digest: string | undefined,
): ApmExtensionEvidence {
  if (moduleIds.length === 0) {
    return { state: 'available', complete: true, observations: [], diagnostics: [] };
  }
  return {
    state: 'available',
    complete: true,
    observations: [
      {
        owner: '@ankhorage/studio',
        projection: 'stale',
        migration: 'not-applicable',
        evidence: pendingEvidence(moduleIds, digest),
        reason: 'Studio has deferred module removals that are not yet materialized.',
        nextAction:
          'Review the pending Studio module lifecycle work before applying project updates.',
      },
    ],
    diagnostics: [],
  };
}

/*** Return incomplete evidence when the pending file exists but has an unsupported shape. */
function malformedEvidence(digest: string): ApmExtensionEvidence {
  const evidence = [...baseEvidence(), `pending-digest:${digest}`];
  return {
    state: 'available',
    complete: false,
    observations: [
      {
        owner: '@ankhorage/studio',
        projection: 'unknown',
        migration: 'not-applicable',
        evidence,
        reason: 'Studio pending module lifecycle state is malformed or unsupported.',
        nextAction: 'Repair or recreate the Studio pending module lifecycle state before updating.',
      },
    ],
    diagnostics: [
      {
        code: 'studio.pending-module-lifecycle.invalid',
        severity: 'error',
        scope: { kind: 'projection', id: STUDIO_PENDING_MODULE_LIFECYCLE_PROJECTION_ID },
        evidence,
        reason: 'The pending module lifecycle file cannot be interpreted safely.',
        nextAction: 'Repair or recreate the Studio pending module lifecycle state before updating.',
      },
    ],
  };
}

/*** Return incomplete evidence when the pending state cannot be read for an unexpected reason. */
function unreadableEvidence(detail: string): ApmExtensionEvidence {
  return {
    state: 'available',
    complete: false,
    observations: [
      {
        owner: '@ankhorage/studio',
        projection: 'unknown',
        migration: 'not-applicable',
        evidence: [...baseEvidence(), detail],
        reason: 'Studio pending module lifecycle state could not be inspected.',
        nextAction: 'Restore readable project state before updating.',
      },
    ],
    diagnostics: [
      {
        code: 'studio.pending-module-lifecycle.unreadable',
        severity: 'error',
        scope: { kind: 'projection', id: STUDIO_PENDING_MODULE_LIFECYCLE_PROJECTION_ID },
        evidence: [...baseEvidence(), detail],
        reason: 'The pending module lifecycle file could not be read.',
        nextAction: 'Restore readable project state before updating.',
      },
    ],
  };
}

/*** Build stable evidence for the pending lifecycle projection. */
function pendingEvidence(
  moduleIds: readonly string[],
  digest: string | undefined,
): readonly string[] {
  return [
    ...baseEvidence(),
    ...(digest === undefined ? [] : [`pending-digest:${digest}`]),
    ...[...moduleIds].sort(compareText).map((moduleId) => `module-uninstall:${moduleId}`),
  ];
}

/*** Build the stable evidence prefix used to recognize Studio's pending lifecycle projection. */
function baseEvidence(): readonly string[] {
  return [STUDIO_PENDING_MODULE_LIFECYCLE_EVIDENCE, STUDIO_PENDING_MODULE_LIFECYCLE_FILE];
}

/*** Compare serialized identifiers without locale-dependent ordering. */
function compareText(left: string, right: string): number {
  if (left < right) return -1;
  return left > right ? 1 : 0;
}
