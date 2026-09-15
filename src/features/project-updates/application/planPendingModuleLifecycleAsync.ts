import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  ApmExtensionArtifactIdentity,
  ApmExtensionArtifactIdentityResolution,
  ApmPlanArtifactIdentity,
  ApmPlanBlocker,
  ApmPlanFileChange,
  ApmPlanStep,
} from '@ankhorage/apm/types';
import type { AppManifest } from '@ankhorage/contracts';

import { isAppManifest } from '../../../contractGuards';
import {
  digestProjectUpdateText,
  readPendingModuleLifecycleStateAsync,
} from '../adapters/outbound/readPendingModuleLifecycleStateAsync';
import {
  STUDIO_PENDING_MODULE_LIFECYCLE_FILE,
  STUDIO_PENDING_MODULE_LIFECYCLE_PROJECTION_ID,
} from '../constants';
import {
  pendingModuleLifecycleIds,
  removeReviewedPendingModules,
  serializePendingModuleLifecycleState,
} from '../domain/pendingModuleLifecycleState';

const STUDIO_MANIFEST_FILE = 'ankh.config.json';
const STUDIO_PACKAGE_NAME = '@ankhorage/studio';
const REMOVAL_STEP_PREFIX = 'projection:@ankhorage/studio:pending-module-remove:';
const FINALIZE_STEP_ID = 'dependency-files:studio-pending-module-lifecycle';

export interface PendingModuleLifecyclePlanSlice {
  readonly files: readonly ApmPlanFileChange[];
  readonly artifacts: readonly ApmPlanArtifactIdentity[];
  readonly steps: readonly ApmPlanStep[];
  readonly blockers: readonly ApmPlanBlocker[];
}

/*** Plan reviewed Orchestrator removals plus APM-native Studio lifecycle file finalization. */
export async function planPendingModuleLifecycleAsync(input: {
  readonly rootPath: string;
  readonly expectedPendingDigest: string;
  readonly resolveArtifactAsync: (
    rootPath: string,
  ) => Promise<ApmExtensionArtifactIdentityResolution>;
  readonly nowIso: () => string;
}): Promise<PendingModuleLifecyclePlanSlice> {
  const pending = await readPendingModuleLifecycleStateAsync(input.rootPath);
  if (pending.state !== 'valid') return blockedPendingState(input.rootPath, pending.state);
  if (pending.digest !== input.expectedPendingDigest) {
    return blockedDigest(input.rootPath, input.expectedPendingDigest, pending.digest);
  }

  const moduleIds = pendingModuleLifecycleIds(pending.value);
  if (moduleIds.length === 0) return emptySlice();
  const artifactResolution = await input.resolveArtifactAsync(input.rootPath);
  if (artifactResolution.state !== 'resolved') {
    return blockedArtifact(input.rootPath, artifactResolution.reason, artifactResolution.evidence);
  }

  const manifestPath = path.join(input.rootPath, STUDIO_MANIFEST_FILE);
  const manifestContent = await readFile(manifestPath, 'utf8');
  const manifestDigest = digestProjectUpdateText(manifestContent);
  const manifest = parseManifest(manifestContent);
  const reviewedIds = new Set(moduleIds);
  const nextManifest = projectReviewedRemovals(manifest, reviewedIds, input.nowIso());
  const nextManifestContent = serializeManifest(nextManifest);
  const nextPending = removeReviewedPendingModules(pending.value, reviewedIds);
  const files = reviewedFileChanges({
    manifestContent,
    nextManifestContent,
    pendingContent: pending.content,
    nextPendingContent:
      nextPending.ops.length === 0 ? undefined : serializePendingModuleLifecycleState(nextPending),
  });
  const removalSteps = moduleIds.map((moduleId, index) =>
    removalStep({
      moduleId,
      prerequisites: index === 0 ? [] : [removalStepId(moduleIds[index - 1] ?? '')],
      pendingDigest: pending.digest,
      manifestDigest,
      artifact: artifactResolution.artifact,
    }),
  );
  const lastRemovalStep = removalSteps.at(-1);
  return {
    files,
    artifacts: [toPlanArtifact(artifactResolution.artifact)],
    steps: [
      ...removalSteps,
      finalizationStep(files, lastRemovalStep === undefined ? [] : [lastRemovalStep.id]),
    ],
    blockers: [],
  };
}

/*** Build one non-restartable dynamic owner step for exactly one Orchestrator module removal. */
function removalStep(input: {
  readonly moduleId: string;
  readonly prerequisites: readonly string[];
  readonly pendingDigest: string;
  readonly manifestDigest: string;
  readonly artifact: ApmExtensionArtifactIdentity;
}): ApmPlanStep {
  const projectionId = `pending-module-remove:${input.moduleId}`;
  const evidence = [
    `module-uninstall:${input.moduleId}`,
    `pending-digest:${input.pendingDigest}`,
    `manifest-digest:${input.manifestDigest}`,
  ];
  return {
    id: removalStepId(input.moduleId),
    kind: 'projection',
    prerequisites: input.prerequisites,
    owner: STUDIO_PACKAGE_NAME,
    reason: `Remove reviewed pending Orchestrator module '${input.moduleId}'.`,
    evidence,
    execution: {
      kind: 'projection',
      descriptor: {
        id: projectionId,
        claims: [{ kind: 'dynamic', scope: `orchestrator-module:${input.moduleId}` }],
        requiresExtension: false,
        reason:
          'Studio delegates module uninstall side effects to the published Orchestrator owner.',
      },
      artifact: input.artifact,
      plan: {
        projectionId,
        mutations: [],
        inputFingerprint: `pending:${input.pendingDigest}:manifest:${input.manifestDigest}:${input.moduleId}`,
        generatorFingerprint: input.artifact.descriptorDigest,
        evidence,
      },
    },
  };
}

/*** Build the native APM file step that commits canonical Studio lifecycle state after removals. */
function finalizationStep(
  files: readonly ApmPlanFileChange[],
  prerequisites: readonly string[],
): ApmPlanStep {
  const filePaths = files.map(({ path: filePath }) => filePath);
  return {
    id: FINALIZE_STEP_ID,
    kind: 'dependency-files',
    prerequisites,
    reason:
      'Commit the reviewed Studio manifest and pending-lifecycle state after module removals.',
    evidence: filePaths,
    execution: { kind: 'dependency-files', filePaths },
  };
}

/*** Build exact reviewed manifest/pending-state changes for APM's native file adapter. */
function reviewedFileChanges(input: {
  readonly manifestContent: string;
  readonly nextManifestContent: string;
  readonly pendingContent: string;
  readonly nextPendingContent?: string;
}): readonly ApmPlanFileChange[] {
  const manifest: ApmPlanFileChange = {
    path: STUDIO_MANIFEST_FILE,
    kind: 'update',
    beforeContent: input.manifestContent,
    beforeDigest: digestProjectUpdateText(input.manifestContent),
    afterContent: input.nextManifestContent,
    afterDigest: digestProjectUpdateText(input.nextManifestContent),
  };
  const pending: ApmPlanFileChange =
    input.nextPendingContent === undefined
      ? {
          path: STUDIO_PENDING_MODULE_LIFECYCLE_FILE,
          kind: 'delete',
          beforeContent: input.pendingContent,
          beforeDigest: digestProjectUpdateText(input.pendingContent),
        }
      : {
          path: STUDIO_PENDING_MODULE_LIFECYCLE_FILE,
          kind: 'update',
          beforeContent: input.pendingContent,
          beforeDigest: digestProjectUpdateText(input.pendingContent),
          afterContent: input.nextPendingContent,
          afterDigest: digestProjectUpdateText(input.nextPendingContent),
        };
  return [manifest, pending];
}

/*** Project reviewed removals into canonical manifest module ids/config without touching other fields. */
function projectReviewedRemovals(
  manifest: AppManifest,
  reviewedIds: ReadonlySet<string>,
  updated: string,
): AppManifest {
  return {
    ...manifest,
    metadata: { ...manifest.metadata, updated },
    infra: {
      ...manifest.infra,
      modules: manifest.infra.modules.filter((moduleId) => !reviewedIds.has(moduleId)),
      modulesConfig: Object.fromEntries(
        Object.entries(manifest.infra.modulesConfig ?? {}).filter(
          ([moduleId]) => !reviewedIds.has(moduleId),
        ),
      ),
    },
  };
}

/*** Parse one canonical Studio project manifest before planning reviewed lifecycle changes. */
function parseManifest(content: string): AppManifest {
  const value: unknown = JSON.parse(content);
  if (!isAppManifest(value)) throw new Error('Project manifest is not a canonical AppManifest.');
  return value;
}

/*** Serialize the exact reviewed manifest bytes APM will materialize. */
function serializeManifest(manifest: AppManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/*** Convert executable extension identity into plan-level immutable artifact evidence. */
function toPlanArtifact(artifact: ApmExtensionArtifactIdentity): ApmPlanArtifactIdentity {
  return {
    id: `${artifact.packageName}@${artifact.version}:${artifact.integrity}`,
    packageName: artifact.packageName,
    version: artifact.version,
    source: 'registry',
    integrity: artifact.integrity,
  };
}

/*** Explain pending-state drift between status evidence and planning I/O. */
function blockedDigest(
  rootPath: string,
  expected: string,
  actual: string,
): PendingModuleLifecyclePlanSlice {
  return blocked({
    code: 'protocol.studio-pending-module-lifecycle-changed',
    scope: {
      kind: 'projection',
      id: STUDIO_PENDING_MODULE_LIFECYCLE_PROJECTION_ID,
      path: rootPath,
    },
    evidence: [expected, actual],
    reason:
      'Studio pending module lifecycle state changed while the reviewed plan was being built.',
    nextAction: 'Refresh status and create a new plan from current pending module state.',
  });
}

/*** Explain unavailable or invalid pending state discovered during planning. */
function blockedPendingState(
  rootPath: string,
  state: 'absent' | 'invalid' | 'unreadable',
): PendingModuleLifecyclePlanSlice {
  return blocked({
    code: 'protocol.studio-pending-module-lifecycle-unavailable',
    scope: {
      kind: 'projection',
      id: STUDIO_PENDING_MODULE_LIFECYCLE_PROJECTION_ID,
      path: rootPath,
    },
    evidence: [state],
    reason: 'Reviewed pending module lifecycle evidence is no longer available for planning.',
    nextAction: 'Refresh status and repair pending lifecycle state before planning again.',
  });
}

/*** Explain missing immutable npm artifact identity for executable Studio owner code. */
function blockedArtifact(
  rootPath: string,
  reason: string,
  evidence: readonly string[],
): PendingModuleLifecyclePlanSlice {
  return blocked({
    code: 'protocol.studio-owner-artifact-unavailable',
    scope: { kind: 'host', id: STUDIO_PACKAGE_NAME, path: rootPath },
    evidence,
    reason,
    nextAction: 'Restore registry access and re-plan so exact Studio owner code can be reviewed.',
  });
}

/*** Return one blocked plan slice without executable intermediate changes. */
function blocked(blocker: ApmPlanBlocker): PendingModuleLifecyclePlanSlice {
  return { files: [], artifacts: [], steps: [], blockers: [blocker] };
}

/*** Return no owner work for an empty pending lifecycle state. */
function emptySlice(): PendingModuleLifecyclePlanSlice {
  return { files: [], artifacts: [], steps: [], blockers: [] };
}

/*** Build the stable reviewed owner-step id for one module. */
function removalStepId(moduleId: string): string {
  return `${REMOVAL_STEP_PREFIX}${moduleId}`;
}
