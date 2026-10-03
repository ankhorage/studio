import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

import {
  resolveMigrationPath,
  validateUpdateDescriptor,
} from '@ankhorage/apm';
import type {
  ApmApplyStepExecutionResult,
  ApmApplyStepObservation,
  ApmApplyStepPort,
  ApmDependencyInventory,
  ApmExtensionArtifactIdentity,
  ApmExtensionEvidence,
  ApmExtensionExecutionContext,
  ApmPlanBlocker,
  ApmPlanPackageSelection,
  ApmPlanProtocolPort,
  ApmPlanProtocolResult,
  ApmPlanStep,
  ApmProjectFileSnapshot,
  ApmProjectMutation,
  ApmProjectionDescriptor,
  ApmProjectionHandler,
  ApmStatusDependency,
  ApmStatusDiagnostic,
  ApmStatusExtensionEvidencePort,
  ApmVerifyCheckResult,
  ApmVerifyStepPort,
} from '@ankhorage/apm/types';
import { isMissingPathError } from '@ankhorage/utility/node/fs';
import { resolvePathWithinRoot } from '@ankhorage/utility/node/path';
import { isRecord } from '@ankhorage/utility/object';
import {
  compareSemanticVersions,
  parseSemanticVersion,
  satisfiesCaretSemverRange,
} from '@ankhorage/utility/semver';

import type { ProjectUpdateServiceOptions } from '../../../types/project-updates';
import { studioUpdateExtension } from '../adapters/inbound/studioUpdateExtension';
import { getGeneratedPackagePolicy } from '../adapters/outbound/getGeneratedPackagePolicy';
import {
  currentStudioApmArtifactMatchesAsync,
  resolveCurrentStudioApmArtifactAsync,
} from '../adapters/outbound/resolveCurrentStudioApmArtifactAsync';

const STUDIO_PACKAGE_NAME = '@ankhorage/studio';
const PACKAGE_POLICY_PROJECTION_ID = 'generated-package-policy';
const DESCRIPTOR_URL = new URL('../../../../apm/update.json', import.meta.url);
const PACKAGE_POLICY_DESCRIPTOR = readPackagePolicyDescriptor();
const PACKAGE_POLICY_HANDLER = readPackagePolicyHandler();

interface StudioSourceBinding {
  readonly packageId: string;
  readonly installRootId: string;
  readonly ownerPath: string;
  readonly version: string;
}

interface GeneratedPolicyPlanSlice {
  readonly requiredSelections: readonly ApmPlanPackageSelection[];
  readonly steps: readonly ApmPlanStep[];
  readonly blockers: readonly ApmPlanBlocker[];
}

const EMPTY_PLAN_SLICE: GeneratedPolicyPlanSlice = {
  requiredSelections: [],
  steps: [],
  blockers: [],
};

/*** Compose Studio's generated-package owner projection into the ordinary APM lifecycle. */
export function createStudioGeneratedPackagePolicyUpdatePorts(
  base: ProjectUpdateServiceOptions = {},
): ProjectUpdateServiceOptions {
  return {
    ...base,
    extensions: createExtensionEvidencePort(base.extensions),
    protocol: createProtocolPort(base.protocol),
    applyOwnerStep: createApplyOwnerStepPort(base.applyOwnerStep),
    verifyOwnerStep: createVerifyOwnerStepPort(base.verifyOwnerStep),
  };
}

/*** Compose current Studio package-policy inspection around any existing owner evidence provider. */
function createExtensionEvidencePort(
  base: ApmStatusExtensionEvidencePort | undefined,
): ApmStatusExtensionEvidencePort {
  return {
    inspectExtensionEvidenceAsync: async (input) => {
      const [baseEvidence, policyEvidence] = await Promise.all([
        base === undefined
          ? Promise.resolve(emptyExtensionEvidence())
          : base.inspectExtensionEvidenceAsync(input),
        inspectGeneratedPolicyEvidenceAsync(input.rootPath, input.inventory),
      ]);
      return mergeExtensionEvidence(baseEvidence, policyEvidence);
    },
  };
}

/*** Inspect one generated app against the exact package policy owned by the running Studio artifact. */
async function inspectGeneratedPolicyEvidenceAsync(
  rootPath: string,
  inventory: ApmDependencyInventory,
): Promise<ApmExtensionEvidence> {
  const source = readSourceBindingFromInventory(inventory);
  if (source === undefined) return emptyExtensionEvidence();
  const artifactResolution = await resolveCurrentStudioApmArtifactAsync(rootPath);
  if (artifactResolution.state !== 'resolved') {
    return failedExtensionEvidence(
      'studio.generated-package-policy.artifact-unavailable',
      artifactResolution.reason,
      artifactResolution.evidence,
    );
  }
  const migration = resolveMigrationPath({
    descriptor: readStudioDescriptor(),
    sourceVersion: source.version,
    targetVersion: getGeneratedPackagePolicy().ownerVersion,
  });
  if (!migration.supported) {
    return {
      state: 'available',
      complete: false,
      observations: [],
      diagnostics: migration.blockers.map(protocolBlockerDiagnostic),
    };
  }
  const context = executionContext(source.version, artifactResolution.artifact);
  const inspection = await PACKAGE_POLICY_HANDLER.inspectAsync({
    descriptor: PACKAGE_POLICY_DESCRIPTOR,
    context,
    project: createProjectReadPort(rootPath),
  });
  return {
    state: 'available',
    complete: inspection.state !== 'unknown',
    observations: [
      {
        packageId: source.packageId,
        owner: STUDIO_PACKAGE_NAME,
        projection: inspection.state,
        migration: migration.noMigrationRequired ? 'not-applicable' : 'pending',
        evidence: [
          `projection:${PACKAGE_POLICY_PROJECTION_ID}`,
          `source:${source.version}`,
          `target:${context.targetVersion}`,
          ...inspection.evidence,
        ],
        ...(inspection.reason === undefined ? {} : { reason: inspection.reason }),
        ...(inspection.state === 'stale'
          ? { nextAction: 'Apply the reviewed Studio update to reconcile generated package policy.' }
          : {}),
      },
    ],
    diagnostics:
      inspection.state === 'unknown'
        ? [
            {
              code: 'studio.generated-package-policy.unknown',
              severity: 'error',
              scope: { kind: 'projection', id: PACKAGE_POLICY_PROJECTION_ID },
              evidence: inspection.evidence,
              reason:
                inspection.reason ??
                'Studio generated package policy could not be inspected safely.',
              nextAction: 'Repair package.json before applying Studio-managed updates.',
            },
          ]
        : [],
  };
}

/*** Compose generated-package planning around any existing package-owner protocol provider. */
function createProtocolPort(base: ApmPlanProtocolPort | undefined): ApmPlanProtocolPort {
  return {
    planProtocolAsync: async (input) => {
      const baseResult =
        base === undefined ? emptyProtocolResult() : await base.planProtocolAsync(input);
      const observation = input.status.extensions.observations.find(
        (candidate) =>
          candidate.owner === STUDIO_PACKAGE_NAME &&
          candidate.evidence.includes(`projection:${PACKAGE_POLICY_PROJECTION_ID}`),
      );
      const policySlice =
        observation?.projection === 'stale' && input.policy.repairProjections
          ? await planGeneratedPolicyAsync(input)
          : EMPTY_PLAN_SLICE;
      const blockers = [...baseResult.blockers, ...policySlice.blockers];
      return {
        ...baseResult,
        complete: baseResult.complete && blockers.length === 0,
        requiredSelections: [
          ...baseResult.requiredSelections,
          ...policySlice.requiredSelections,
        ],
        steps: [...baseResult.steps, ...policySlice.steps],
        blockers,
      };
    },
  };
}

/*** Plan exact target-owner package policy and feed its dependency floors into APM's fixed-point resolver. */
async function planGeneratedPolicyAsync(
  input: Parameters<ApmPlanProtocolPort['planProtocolAsync']>[0],
): Promise<GeneratedPolicyPlanSlice> {
  const source = readSourceBindingFromStatus(input.status.dependencies);
  if (source === undefined) {
    return {
      ...EMPTY_PLAN_SLICE,
      blockers: [
        protocolPlanBlocker(
          'protocol.studio-generated-package-policy-source-missing',
          'The generated app has no uniquely resolved direct @ankhorage/studio source package.',
          [],
        ),
      ],
    };
  }
  const artifactResolution = await resolveCurrentStudioApmArtifactAsync(input.status.rootPath);
  if (artifactResolution.state !== 'resolved') {
    return {
      ...EMPTY_PLAN_SLICE,
      blockers: [
        protocolPlanBlocker(
          'protocol.studio-generated-package-policy-artifact-unavailable',
          artifactResolution.reason,
          artifactResolution.evidence,
        ),
      ],
    };
  }
  const context = executionContext(source.version, artifactResolution.artifact);
  const plan = await PACKAGE_POLICY_HANDLER.planAsync({
    descriptor: PACKAGE_POLICY_DESCRIPTOR,
    context,
    project: createProjectReadPort(input.status.rootPath),
  });
  const selections = requiredSelections(input.status.dependencies, plan.mutations);
  if (selections.blockers.length > 0) {
    return { ...EMPTY_PLAN_SLICE, blockers: selections.blockers };
  }
  return {
    requiredSelections: selections.selections,
    steps: [
      {
        id: `projection:${STUDIO_PACKAGE_NAME}:${PACKAGE_POLICY_PROJECTION_ID}`,
        kind: 'projection',
        prerequisites: [],
        owner: STUDIO_PACKAGE_NAME,
        reason: 'Reconcile generated package policy to the exact running Studio owner artifact.',
        evidence: [
          `source:${source.version}`,
          `target:${context.targetVersion}`,
          ...plan.evidence,
        ],
        execution: {
          kind: 'projection',
          descriptor: PACKAGE_POLICY_DESCRIPTOR,
          artifact: artifactResolution.artifact,
          plan,
        },
      },
    ],
    blockers: [],
  };
}

interface RequiredSelectionResult {
  readonly selections: readonly ApmPlanPackageSelection[];
  readonly blockers: readonly ApmPlanBlocker[];
}

/*** Convert reviewed dependency-range mutations into exact safe APM dependency selections. */
function requiredSelections(
  dependencies: readonly ApmStatusDependency[],
  mutations: readonly ApmProjectMutation[],
): RequiredSelectionResult {
  return mutations.reduce<RequiredSelectionResult>(
    (result, mutation) => appendRequiredSelection(result, dependencies, mutation),
    { selections: [], blockers: [] },
  );
}

/*** Add one dependency selection when a reviewed package-policy mutation changes its declaration range. */
function appendRequiredSelection(
  result: RequiredSelectionResult,
  dependencies: readonly ApmStatusDependency[],
  mutation: ApmProjectMutation,
): RequiredSelectionResult {
  const desired = readManagedDependencyMutation(mutation);
  if (desired === undefined) return result;
  const matches = dependencies.filter(
    (dependency) =>
      dependency.direct &&
      dependency.name === desired.name &&
      dependency.declaration?.ownerPath === 'package.json',
  );
  const [dependency] = matches;
  if (matches.length !== 1 || dependency?.declaration === undefined) {
    return {
      selections: result.selections,
      blockers: [
        ...result.blockers,
        protocolPlanBlocker(
          'protocol.studio-generated-package-policy-dependency-missing',
          `Studio package policy requires managed dependency ${desired.name}, but the current generated app does not expose one unique direct declaration.`,
          [desired.name, `matches:${matches.length}`],
        ),
      ],
    };
  }
  if (dependency.declaration.range === desired.range) return result;
  const currentVersion = dependency.lockedVersion ?? dependency.installed.version;
  const targetVersion =
    currentVersion !== undefined && versionSatisfiesManagedRange(currentVersion, desired.range)
      ? currentVersion
      : managedRangeFloor(desired.range);
  if (targetVersion === undefined) {
    return {
      selections: result.selections,
      blockers: [
        ...result.blockers,
        protocolPlanBlocker(
          'protocol.studio-generated-package-policy-range-unsupported',
          `Studio generated package policy uses an unsupported managed dependency range for ${desired.name}.`,
          [desired.name, desired.range],
        ),
      ],
    };
  }
  return {
    selections: [
      ...result.selections,
      {
        selector: {
          name: dependency.name,
          packageId: dependency.packageId,
          installRootId: dependency.installRootId,
          ownerPath: dependency.declaration.ownerPath,
        },
        target: {
          kind: 'version',
          version: targetVersion,
          manifestRange: desired.range,
        },
      },
    ],
    blockers: result.blockers,
  };
}

interface ManagedDependencyMutation {
  readonly name: string;
  readonly range: string;
}

/*** Read dependency/devDependency range intent from one Studio package-policy mutation. */
function readManagedDependencyMutation(
  mutation: ApmProjectMutation,
): ManagedDependencyMutation | undefined {
  if (
    mutation.kind !== 'set-json-pointer' ||
    mutation.path !== 'package.json' ||
    typeof mutation.value !== 'string'
  ) {
    return undefined;
  }
  const match = /^\/(?:dependencies|devDependencies)\/([^/]+)$/u.exec(mutation.pointer);
  const encodedName = match?.[1];
  return encodedName === undefined
    ? undefined
    : { name: decodeJsonPointerSegment(encodedName), range: mutation.value };
}

/*** Return the exact minimum version represented by Studio's managed exact/caret/tilde ranges. */
function managedRangeFloor(range: string): string | undefined {
  const exact = range.startsWith('^') || range.startsWith('~') ? range.slice(1) : range;
  return parseSemanticVersion(exact) === null ? undefined : exact;
}

/*** Test current versions against the exact/caret/tilde range shapes emitted by Studio policy. */
function versionSatisfiesManagedRange(version: string, range: string): boolean {
  if (range.startsWith('^')) return satisfiesCaretSemverRange(version, range);
  const candidate = parseSemanticVersion(version);
  const minimum = parseSemanticVersion(range.startsWith('~') ? range.slice(1) : range);
  if (candidate === null || minimum === null) return false;
  if (!range.startsWith('~')) return compareSemanticVersions(candidate, minimum) === 0;
  return (
    compareSemanticVersions(candidate, minimum) >= 0 &&
    candidate.major === minimum.major &&
    candidate.minor === minimum.minor
  );
}

/*** Compose exact reviewed projection execution around any other trusted owner executor. */
function createApplyOwnerStepPort(base: ApmApplyStepPort | undefined): ApmApplyStepPort {
  return {
    observeAsync: async (input) =>
      isPackagePolicyStep(input.step)
        ? observePackagePolicyStepAsync(input.journal.rootPath, input.step)
        : delegateApplyObservationAsync(base, input),
    executeAsync: async (input) =>
      isPackagePolicyStep(input.step)
        ? executePackagePolicyStepAsync(input.journal.rootPath, input.step)
        : delegateApplyExecutionAsync(base, 'executeAsync', input),
    rollbackAsync: async (input) =>
      isPackagePolicyStep(input.step)
        ? Promise.resolve({
            state: 'completed',
            evidence: ['owner-approved-snapshot-restore'],
            diagnostics: [],
          })
        : delegateApplyExecutionAsync(base, 'rollbackAsync', input),
  };
}

/*** Observe whether the reviewed package-policy projection is already satisfied or still pending. */
async function observePackagePolicyStepAsync(
  rootPath: string,
  step: ApmPlanStep,
): Promise<ApmApplyStepObservation> {
  if (step.execution.kind !== 'projection') {
    return { state: 'unknown', evidence: [step.id], reason: 'Projection execution is missing.' };
  }
  if (!(await currentStudioApmArtifactMatchesAsync(step.execution.artifact))) {
    return {
      state: 'conflict',
      evidence: [`${step.execution.artifact.packageName}@${step.execution.artifact.version}`],
      reason: 'Running Studio owner code no longer matches the reviewed projection artifact.',
    };
  }
  const inspection = await PACKAGE_POLICY_HANDLER.inspectAsync({
    descriptor: PACKAGE_POLICY_DESCRIPTOR,
    context: executionContext(step.execution.artifact.version, step.execution.artifact),
    project: createProjectReadPort(rootPath),
  });
  if (inspection.state === 'unknown') {
    return {
      state: 'unknown',
      evidence: inspection.evidence,
      ...(inspection.reason === undefined ? {} : { reason: inspection.reason }),
    };
  }
  const satisfied =
    inspection.state === 'current' &&
    inspection.generatorFingerprint === step.execution.plan.generatorFingerprint;
  return satisfied
    ? { state: 'satisfied', evidence: inspection.evidence }
    : { state: 'pending', evidence: inspection.evidence };
}

/*** Execute only mutation IDs frozen into the reviewed Studio package-policy projection plan. */
async function executePackagePolicyStepAsync(
  rootPath: string,
  step: ApmPlanStep,
): Promise<ApmApplyStepExecutionResult> {
  if (step.execution.kind !== 'projection') {
    return failedApplyExecution(
      'studio.generated-package-policy.execution-invalid',
      'Reviewed package-policy step has no projection execution descriptor.',
      step.id,
    );
  }
  if (!(await currentStudioApmArtifactMatchesAsync(step.execution.artifact))) {
    return failedApplyExecution(
      'studio.generated-package-policy.artifact-mismatch',
      'Running Studio owner code no longer matches the reviewed projection artifact.',
      `${step.execution.artifact.packageName}@${step.execution.artifact.version}`,
    );
  }
  const byId = new Map(step.execution.plan.mutations.map((mutation) => [mutation.id, mutation]));
  try {
    await PACKAGE_POLICY_HANDLER.materializeAsync({
      descriptor: PACKAGE_POLICY_DESCRIPTOR,
      context: executionContext(step.execution.artifact.version, step.execution.artifact),
      plan: step.execution.plan,
      project: {
        ...createProjectReadPort(rootPath),
        applyReviewedMutationAsync: async (mutationId) => {
          const mutation = byId.get(mutationId);
          if (mutation === undefined) throw new Error(`Unreviewed mutation '${mutationId}'.`);
          await applyReviewedPackageMutationAsync(rootPath, mutation);
        },
      },
    });
    return {
      state: 'completed',
      evidence: step.execution.plan.mutations.map(({ id }) => id),
      diagnostics: [],
    };
  } catch (error) {
    return failedApplyExecution(
      'studio.generated-package-policy.execution-failed',
      error instanceof Error ? error.message : 'Studio package-policy execution failed.',
      step.id,
    );
  }
}

/*** Apply one reviewed JSON-pointer package mutation while preserving all unrelated manifest fields. */
async function applyReviewedPackageMutationAsync(
  rootPath: string,
  mutation: ApmProjectMutation,
): Promise<void> {
  if (
    mutation.path !== 'package.json' ||
    (mutation.kind !== 'set-json-pointer' && mutation.kind !== 'remove-json-pointer')
  ) {
    throw new Error(`Unsupported generated package-policy mutation '${mutation.id}'.`);
  }
  const packagePath = resolvePathWithinRoot(rootPath, mutation.path);
  const value: unknown = JSON.parse(await readFile(packagePath, 'utf8'));
  if (!isRecord(value)) throw new Error('Generated package.json must contain an object.');
  const segments = mutation.pointer
    .split('/')
    .slice(1)
    .map(decodeJsonPointerSegment);
  const updated =
    mutation.kind === 'set-json-pointer'
      ? setJsonPointer(value, segments, mutation.value)
      : removeJsonPointer(value, segments);
  await writeFile(packagePath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');
}

/*** Set one reviewed JSON pointer immutably through object-only package manifest paths. */
function setJsonPointer(
  value: Readonly<Record<string, unknown>>,
  segments: readonly string[],
  replacement: unknown,
): Readonly<Record<string, unknown>> {
  const [head, ...tail] = segments;
  if (head === undefined) throw new Error('Package-policy JSON pointer cannot target the root.');
  if (tail.length === 0) return { ...value, [head]: replacement };
  const child = value[head];
  if (!isRecord(child)) throw new Error(`Package-policy pointer parent '${head}' is not an object.`);
  return { ...value, [head]: setJsonPointer(child, tail, replacement) };
}

/*** Remove one reviewed JSON pointer immutably without disturbing sibling manifest data. */
function removeJsonPointer(
  value: Readonly<Record<string, unknown>>,
  segments: readonly string[],
): Readonly<Record<string, unknown>> {
  const [head, ...tail] = segments;
  if (head === undefined) throw new Error('Package-policy JSON pointer cannot target the root.');
  if (tail.length === 0) {
    return Object.fromEntries(Object.entries(value).filter(([key]) => key !== head));
  }
  const child = value[head];
  if (!isRecord(child)) return value;
  return { ...value, [head]: removeJsonPointer(child, tail) };
}

/*** Compose package-policy verification around any other package-owner verifier. */
function createVerifyOwnerStepPort(base: ApmVerifyStepPort | undefined): ApmVerifyStepPort {
  return {
    verifyAsync: async (input) =>
      isPackagePolicyStep(input.step)
        ? [await verifyPackagePolicyStepAsync(input.journal.rootPath, input.step)]
        : delegateVerifyAsync(base, input),
  };
}

/*** Verify the exact reviewed target owner generator against the resulting generated app. */
async function verifyPackagePolicyStepAsync(
  rootPath: string,
  step: ApmPlanStep,
): Promise<ApmVerifyCheckResult> {
  if (step.execution.kind !== 'projection') {
    return {
      id: `verify:${step.id}`,
      kind: 'projection',
      status: 'unknown',
      evidence: [step.id],
      reason: 'Reviewed package-policy projection execution is missing.',
    };
  }
  if (!(await currentStudioApmArtifactMatchesAsync(step.execution.artifact))) {
    return {
      id: `verify:${step.id}`,
      kind: 'projection',
      status: 'unknown',
      evidence: [`${step.execution.artifact.packageName}@${step.execution.artifact.version}`],
      reason: 'Running Studio owner code no longer matches the reviewed projection artifact.',
    };
  }
  const result = await PACKAGE_POLICY_HANDLER.verifyAsync({
    descriptor: PACKAGE_POLICY_DESCRIPTOR,
    context: executionContext(step.execution.artifact.version, step.execution.artifact),
    plan: step.execution.plan,
    project: {
      ...createProjectReadPort(rootPath),
      applyReviewedMutationAsync: () =>
        Promise.reject(new Error('Verification must not mutate generated package policy.')),
    },
  });
  return {
    id: `verify:${step.id}`,
    kind: 'projection',
    status: result.valid ? 'passed' : 'failed',
    evidence: result.evidence,
    ...(result.reason === undefined ? {} : { reason: result.reason }),
  };
}

/*** Identify only the canonical Studio generated-package-policy projection step. */
function isPackagePolicyStep(step: ApmPlanStep): boolean {
  return (
    step.owner === STUDIO_PACKAGE_NAME &&
    step.execution.kind === 'projection' &&
    step.execution.descriptor.id === PACKAGE_POLICY_PROJECTION_ID
  );
}

/*** Build an exact immutable target-owner extension context. */
function executionContext(
  sourceVersion: string,
  artifact: ApmExtensionArtifactIdentity,
): ApmExtensionExecutionContext {
  return {
    owner: STUDIO_PACKAGE_NAME,
    sourceVersion,
    targetVersion: artifact.version,
    artifact,
  };
}

/*** Build the bounded Node read capabilities required by the Studio projection. */
function createProjectReadPort(rootPath: string) {
  return {
    readFileAsync: async (relativePath: string): Promise<ApmProjectFileSnapshot> => {
      const filePath = resolvePathWithinRoot(rootPath, relativePath);
      try {
        const content = await readFile(filePath, 'utf8');
        return {
          path: relativePath,
          exists: true,
          digest: sha256(content),
          encoding: 'utf8' as const,
          content,
        };
      } catch (error) {
        if (isMissingPathError(error)) return { path: relativePath, exists: false };
        throw error;
      }
    },
    listFilesAsync: async (scope: ApmProjectionDescriptor['claims'][number]) => {
      if (scope.kind === 'dynamic') return [];
      return [await createProjectReadPort(rootPath).readFileAsync(scope.path)];
    },
  };
}

/*** Resolve one direct Studio package from manager-native inventory evidence. */
function readSourceBindingFromInventory(
  inventory: ApmDependencyInventory,
): StudioSourceBinding | undefined {
  const candidates = inventory.roots.flatMap((root) =>
    root.declarations.flatMap((declaration) => {
      if (
        declaration.name !== STUDIO_PACKAGE_NAME ||
        declaration.resolvedPackageId === undefined
      ) {
        return [];
      }
      const locked = root.lockedPackages.find(
        (pkg) => pkg.id === declaration.resolvedPackageId,
      );
      return locked?.version === undefined
        ? []
        : [
            {
              packageId: `${root.id}::${locked.id}`,
              installRootId: root.id,
              ownerPath: declaration.ownerPath,
              version: locked.version,
            },
          ];
    }),
  );
  return candidates.length === 1 ? candidates[0] : undefined;
}

/*** Resolve one direct Studio dependency from evaluated APM status evidence. */
function readSourceBindingFromStatus(
  dependencies: readonly ApmStatusDependency[],
): StudioSourceBinding | undefined {
  const candidates = dependencies.filter(
    (dependency) =>
      dependency.direct &&
      dependency.name === STUDIO_PACKAGE_NAME &&
      dependency.declaration !== undefined,
  );
  const [dependency] = candidates;
  const version = dependency?.lockedVersion ?? dependency?.installed.version;
  return candidates.length === 1 &&
    dependency?.declaration !== undefined &&
    version !== undefined
    ? {
        packageId: dependency.packageId,
        installRootId: dependency.installRootId,
        ownerPath: dependency.declaration.ownerPath,
        version,
      }
    : undefined;
}

/*** Read and validate the immutable Studio update descriptor shipped with this package artifact. */
function readStudioDescriptor() {
  const descriptor: unknown = JSON.parse(
    requireDescriptorSource(),
  );
  const validation = validateUpdateDescriptor({
    descriptor,
    expectedOwner: {
      name: STUDIO_PACKAGE_NAME,
      version: getGeneratedPackagePolicy().ownerVersion,
    },
  });
  if (!validation.valid || validation.descriptor === undefined) {
    throw new Error('Studio APM update descriptor is invalid for the running package artifact.');
  }
  return validation.descriptor;
}

/*** Read the static descriptor source from the package artifact without project filesystem access. */
function requireDescriptorSource(): string {
  const { readFileSync } = requireNodeFs();
  return readFileSync(DESCRIPTOR_URL, 'utf8');
}

/*** Keep synchronous static descriptor loading isolated from project mutation I/O. */
function requireNodeFs(): typeof import('node:fs') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('node:fs') as typeof import('node:fs');
}

/*** Resolve the exact generated package-policy descriptor once from validated static metadata. */
function readPackagePolicyDescriptor(): ApmProjectionDescriptor {
  const projection = readStudioDescriptor().projections.find(
    ({ id }) => id === PACKAGE_POLICY_PROJECTION_ID,
  );
  if (projection === undefined) throw new Error('Studio package-policy projection is missing.');
  return projection;
}

/*** Resolve the exact generated package-policy runtime handler once from the current Studio artifact. */
function readPackagePolicyHandler(): ApmProjectionHandler {
  const handler = studioUpdateExtension.projections.find(
    ({ id }) => id === PACKAGE_POLICY_PROJECTION_ID,
  );
  if (handler === undefined) throw new Error('Studio package-policy projection handler is missing.');
  return handler;
}

/*** Convert protocol validation blockers into ordinary status diagnostics without losing evidence. */
function protocolBlockerDiagnostic(
  blocker: ReturnType<typeof resolveMigrationPath>['blockers'][number],
): ApmStatusDiagnostic {
  return {
    code: blocker.code,
    severity: 'error',
    scope: { kind: 'migration', ...(blocker.scope.id === undefined ? {} : { id: blocker.scope.id }) },
    evidence: blocker.evidence,
    reason: blocker.reason,
    ...(blocker.nextAction === undefined ? {} : { nextAction: blocker.nextAction }),
  };
}

/*** Build one package-policy planning blocker with stable protocol ownership. */
function protocolPlanBlocker(
  code: `protocol.${string}`,
  reason: string,
  evidence: readonly string[],
): ApmPlanBlocker {
  return {
    code,
    scope: { kind: 'projection', id: PACKAGE_POLICY_PROJECTION_ID },
    evidence,
    reason,
  };
}

/*** Build one failed owner execution result. */
function failedApplyExecution(
  code: string,
  reason: string,
  ...evidence: readonly string[]
): ApmApplyStepExecutionResult {
  return {
    state: 'failed',
    evidence,
    diagnostics: [],
    failure: { code, reason, evidence },
  };
}

/*** Delegate unrelated owner observations without claiming package-owner capability. */
async function delegateApplyObservationAsync(
  base: ApmApplyStepPort | undefined,
  input: Parameters<ApmApplyStepPort['observeAsync']>[0],
): Promise<ApmApplyStepObservation> {
  return base === undefined
    ? {
        state: 'unknown',
        evidence: [input.step.id],
        reason: 'No trusted Studio owner adapter handles this reviewed step.',
      }
    : base.observeAsync(input);
}

/*** Delegate unrelated owner execution or rollback to the previously composed owner adapter. */
async function delegateApplyExecutionAsync(
  base: ApmApplyStepPort | undefined,
  action: 'executeAsync' | 'rollbackAsync',
  input: Parameters<ApmApplyStepPort['executeAsync']>[0],
): Promise<ApmApplyStepExecutionResult> {
  if (base === undefined) {
    return failedApplyExecution(
      'studio.owner-step.unavailable',
      'No trusted Studio owner adapter handles this reviewed step.',
      input.step.id,
    );
  }
  return action === 'executeAsync'
    ? base.executeAsync(input)
    : base.rollbackAsync(input);
}

/*** Delegate unrelated owner verification without hiding a missing trusted verifier. */
async function delegateVerifyAsync(
  base: ApmVerifyStepPort | undefined,
  input: Parameters<ApmVerifyStepPort['verifyAsync']>[0],
): Promise<readonly ApmVerifyCheckResult[]> {
  return base === undefined
    ? [
        {
          id: `verify:${input.step.id}`,
          kind: input.step.kind === 'migration' ? 'migration' : 'projection',
          status: 'unknown',
          evidence: [input.step.id],
          reason: 'No trusted Studio owner verifier handles this reviewed step.',
        },
      ]
    : base.verifyAsync(input);
}

/*** Merge independent extension evidence while preserving fail-closed completeness. */
function mergeExtensionEvidence(
  base: ApmExtensionEvidence,
  policy: ApmExtensionEvidence,
): ApmExtensionEvidence {
  return {
    state:
      base.state === 'available' || policy.state === 'available' ? 'available' : 'unavailable',
    complete: base.complete && policy.complete,
    observations: [...base.observations, ...policy.observations],
    diagnostics: [...base.diagnostics, ...policy.diagnostics],
  };
}

/*** Return explicit empty owner evidence for projects that do not embed Studio. */
function emptyExtensionEvidence(): ApmExtensionEvidence {
  return {
    state: 'unavailable',
    complete: true,
    observations: [],
    diagnostics: [],
  };
}

/*** Return incomplete owner evidence when current target artifact identity cannot be established. */
function failedExtensionEvidence(
  code: string,
  reason: string,
  evidence: readonly string[],
): ApmExtensionEvidence {
  return {
    state: 'available',
    complete: false,
    observations: [],
    diagnostics: [
      {
        code,
        severity: 'error',
        scope: { kind: 'projection', id: PACKAGE_POLICY_PROJECTION_ID },
        evidence,
        reason,
      },
    ],
  };
}

/*** Return an empty protocol result for composition around ownerless projects. */
function emptyProtocolResult(): ApmPlanProtocolResult {
  return {
    complete: true,
    requiredSelections: [],
    files: [],
    artifacts: [],
    steps: [],
    effects: [],
    findings: [],
    blockers: [],
    diagnostics: [],
  };
}

/*** Decode one RFC 6901 JSON pointer segment. */
function decodeJsonPointerSegment(value: string): string {
  return value.replaceAll('~1', '/').replaceAll('~0', '~');
}

/*** Return a stable SHA-256 digest for projection input evidence. */
function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
