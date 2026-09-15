import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { ApmExtensionEvidence } from '@ankhorage/apm/types';
import { isRecord } from '@ankhorage/utility/object';

import {
  STUDIO_PENDING_MODULE_LIFECYCLE_EVIDENCE,
  STUDIO_PENDING_MODULE_LIFECYCLE_FILE,
  STUDIO_PENDING_MODULE_LIFECYCLE_PROJECTION_ID,
} from '../../constants';

/*** Inspect Studio's deferred module removals without mutating or executing the project. */
export async function inspectPendingModuleLifecycleEvidenceAsync(
  rootPath: string,
): Promise<ApmExtensionEvidence> {
  const filePath = path.join(rootPath, STUDIO_PENDING_MODULE_LIFECYCLE_FILE);
  try {
    const content = await readFile(filePath, 'utf8');
    return toExtensionEvidence(parsePendingModuleIds(content));
  } catch (error: unknown) {
    return isMissingFileError(error) ? availableEvidence([]) : unreadableEvidence(error);
  }
}

type PendingModuleParseResult =
  { readonly valid: true; readonly moduleIds: readonly string[] } | { readonly valid: false };

/*** Parse only the current Studio pending-operation shape and reject ambiguous state. */
function parsePendingModuleIds(content: string): PendingModuleParseResult {
  const value = parseJson(content);
  if (!isRecord(value) || !Array.isArray(value.ops)) return { valid: false };
  const moduleIds = value.ops.map(readPendingModuleId);
  if (moduleIds.some((moduleId) => moduleId === undefined)) return { valid: false };
  const ids = moduleIds.filter((moduleId): moduleId is string => moduleId !== undefined);
  return { valid: true, moduleIds: [...new Set(ids)].sort(compareText) };
}

/*** Parse JSON into unknown data without allowing JSON.parse's any type beyond this boundary. */
function parseJson(content: string): unknown {
  try {
    const value: unknown = JSON.parse(content);
    return value;
  } catch {
    return undefined;
  }
}

/*** Validate one queued uninstall operation and return its normalized module id. */
function readPendingModuleId(value: unknown): string | undefined {
  if (!isRecord(value) || value.type !== 'uninstall') return undefined;
  if (typeof value.moduleId !== 'string' || value.moduleId.trim() === '') return undefined;
  if (typeof value.at !== 'string' || value.at.trim() === '') return undefined;
  return value.moduleId.trim();
}

/*** Convert parsed pending state into conservative APM extension evidence. */
function toExtensionEvidence(result: PendingModuleParseResult): ApmExtensionEvidence {
  if (!result.valid) return malformedEvidence();
  return availableEvidence(result.moduleIds);
}

/*** Return complete Studio extension evidence for absent, empty, or valid pending state. */
function availableEvidence(moduleIds: readonly string[]): ApmExtensionEvidence {
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
        evidence: pendingEvidence(moduleIds),
        reason: 'Studio has deferred module removals that are not yet materialized.',
        nextAction:
          'Review the pending Studio module lifecycle work before applying project updates.',
      },
    ],
    diagnostics: [],
  };
}

/*** Return incomplete evidence when the pending file exists but has an unsupported shape. */
function malformedEvidence(): ApmExtensionEvidence {
  const evidence = baseEvidence();
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
function unreadableEvidence(error: unknown): ApmExtensionEvidence {
  const detail = error instanceof Error ? error.message : 'unknown pending-state read failure';
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
function pendingEvidence(moduleIds: readonly string[]): readonly string[] {
  return [...baseEvidence(), ...moduleIds.map((moduleId) => `module-uninstall:${moduleId}`)];
}

/*** Build the stable evidence prefix used to recognize Studio's pending lifecycle projection. */
function baseEvidence(): readonly string[] {
  return [STUDIO_PENDING_MODULE_LIFECYCLE_EVIDENCE, STUDIO_PENDING_MODULE_LIFECYCLE_FILE];
}

/*** Detect a missing pending file without depending on a Node-specific error assertion. */
function isMissingFileError(error: unknown): boolean {
  return isRecord(error) && error.code === 'ENOENT';
}

/*** Compare serialized identifiers without locale-dependent ordering. */
function compareText(left: string, right: string): number {
  if (left < right) return -1;
  return left > right ? 1 : 0;
}
