import type {
  ApmPlanBlocker,
  ApmPlanPackageSelection,
  ApmPlanProtocolPort,
  ApmPlanProtocolResult,
  ApmPlanStep,
  ApmProjectMutation,
  ApmStatusDependency,
} from '@ankhorage/apm/types';
import {
  compareSemanticVersions,
  parseSemanticVersion,
  satisfiesCaretSemverRange,
} from '@ankhorage/utility/semver';

import { createStudioGeneratedPackagePolicyProjectReadPort } from '../adapters/outbound/createStudioGeneratedPackagePolicyProjectReadPort';
import { readStudioGeneratedPackagePolicyHandler } from '../adapters/outbound/readStudioGeneratedPackagePolicyHandler';
import { readStudioGeneratedPackagePolicyProjectionDescriptor } from '../adapters/outbound/readStudioGeneratedPackagePolicyProjectionDescriptor';
import { resolveCurrentStudioApmArtifactAsync } from '../adapters/outbound/resolveCurrentStudioApmArtifactAsync';
import { STUDIO_GENERATED_PACKAGE_POLICY_PROJECTION_ID, STUDIO_PACKAGE_NAME } from '../constants';
import { createStudioGeneratedPackagePolicyExecutionContext } from '../domain/createStudioGeneratedPackagePolicyExecutionContext';
import { readStudioGeneratedPackagePolicyMutationTarget } from '../domain/readStudioGeneratedPackagePolicyMutationTarget';
import { readStudioGeneratedPackagePolicyStatusSource } from '../domain/readStudioGeneratedPackagePolicyStatusSource';

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

/*** Compose Studio generated-package planning around an existing package-owner protocol provider. */
export function createStudioGeneratedPackagePolicyProtocolPort(
  base: ApmPlanProtocolPort | undefined,
  resolveArtifactAsync: typeof resolveCurrentStudioApmArtifactAsync,
): ApmPlanProtocolPort {
  return {
    planProtocolAsync: async (input) => {
      const baseResult =
        base === undefined ? emptyProtocolResult() : await base.planProtocolAsync(input);
      const observation = input.status.extensions.observations.find(
        (candidate) =>
          candidate.owner === STUDIO_PACKAGE_NAME &&
          candidate.evidence.includes(
            `projection:${STUDIO_GENERATED_PACKAGE_POLICY_PROJECTION_ID}`,
          ),
      );
      const policySlice =
        observation?.projection === 'stale' && input.policy.repairProjections
          ? await planGeneratedPolicyAsync(input, resolveArtifactAsync)
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

/*** Plan target-owner package policy and feed managed dependency ranges into APM fixed-point resolution. */
async function planGeneratedPolicyAsync(
  input: Parameters<ApmPlanProtocolPort['planProtocolAsync']>[0],
  resolveArtifactAsync: typeof resolveCurrentStudioApmArtifactAsync,
): Promise<GeneratedPolicyPlanSlice> {
  const source = readStudioGeneratedPackagePolicyStatusSource(input.status.dependencies);
  if (source === undefined) {
    return blockedPlanSlice(
      'protocol.studio-generated-package-policy-source-missing',
      'The generated app has no uniquely resolved direct @ankhorage/studio source package.',
      [],
    );
  }
  const artifactResolution = await resolveArtifactAsync(input.status.rootPath);
  if (artifactResolution.state !== 'resolved') {
    return blockedPlanSlice(
      'protocol.studio-generated-package-policy-artifact-unavailable',
      artifactResolution.reason,
      artifactResolution.evidence,
    );
  }
  const context = createStudioGeneratedPackagePolicyExecutionContext(
    source.version,
    artifactResolution.artifact,
  );
  const plan = await readStudioGeneratedPackagePolicyHandler().planAsync({
    descriptor: readStudioGeneratedPackagePolicyProjectionDescriptor(),
    context,
    project: createStudioGeneratedPackagePolicyProjectReadPort(input.status.rootPath),
  });
  const selectionResult = requiredSelections(
    input.status.dependencies,
    source.installRootId,
    source.ownerPath,
    plan.mutations,
  );
  if (selectionResult.blockers.length > 0) {
    return { ...EMPTY_PLAN_SLICE, blockers: selectionResult.blockers };
  }
  return {
    requiredSelections: selectionResult.selections,
    steps: [
      {
        id: `projection:${STUDIO_PACKAGE_NAME}:${STUDIO_GENERATED_PACKAGE_POLICY_PROJECTION_ID}`,
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
          descriptor: readStudioGeneratedPackagePolicyProjectionDescriptor(),
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
  installRootId: string,
  ownerPath: string,
  mutations: readonly ApmProjectMutation[],
): RequiredSelectionResult {
  return mutations.reduce<RequiredSelectionResult>(
    (result, mutation) =>
      appendRequiredSelection(result, dependencies, installRootId, ownerPath, mutation),
    { selections: [], blockers: [] },
  );
}

/*** Add one dependency selection when a reviewed package-policy mutation changes its declaration range. */
function appendRequiredSelection(
  result: RequiredSelectionResult,
  dependencies: readonly ApmStatusDependency[],
  installRootId: string,
  ownerPath: string,
  mutation: ApmProjectMutation,
): RequiredSelectionResult {
  const target = readStudioGeneratedPackagePolicyMutationTarget(mutation);
  if (
    target === undefined ||
    target.section === 'packageManager' ||
    mutation.kind !== 'set-json-pointer' ||
    typeof mutation.value !== 'string'
  ) {
    return result;
  }
  const matches = dependencies.filter(
    (dependency) =>
      dependency.direct &&
      dependency.installRootId === installRootId &&
      dependency.name === target.name &&
      dependency.declaration?.ownerPath === ownerPath,
  );
  const [dependency] = matches;
  if (matches.length !== 1 || dependency?.declaration === undefined) {
    return {
      selections: result.selections,
      blockers: [
        ...result.blockers,
        protocolPlanBlocker(
          'protocol.studio-generated-package-policy-dependency-missing',
          `Studio package policy requires managed dependency ${target.name}, but the current generated app does not expose one unique direct declaration.`,
          [target.name, `matches:${matches.length}`],
        ),
      ],
    };
  }
  if (dependency.declaration.range === mutation.value) return result;
  const currentVersion = dependency.lockedVersion ?? dependency.installed.version;
  const targetVersion =
    currentVersion !== undefined && versionSatisfiesManagedRange(currentVersion, mutation.value)
      ? currentVersion
      : managedRangeFloor(mutation.value);
  if (targetVersion === undefined) {
    return {
      selections: result.selections,
      blockers: [
        ...result.blockers,
        protocolPlanBlocker(
          'protocol.studio-generated-package-policy-range-unsupported',
          `Studio generated package policy uses an unsupported managed dependency range for ${target.name}.`,
          [target.name, mutation.value],
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
          manifestRange: mutation.value,
        },
      },
    ],
    blockers: result.blockers,
  };
}

/*** Return the exact minimum version represented by Studio's managed exact/caret/tilde ranges. */
function managedRangeFloor(range: string): string | undefined {
  const exact = range.startsWith('^') || range.startsWith('~') ? range.slice(1) : range;
  return parseSemanticVersion(exact) === null ? undefined : exact;
}

/*** Test current versions against exact/caret/tilde range shapes emitted by Studio policy. */
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

/*** Build an incomplete generated-policy slice with one stable protocol blocker. */
function blockedPlanSlice(
  code: `protocol.${string}`,
  reason: string,
  evidence: readonly string[],
): GeneratedPolicyPlanSlice {
  return {
    ...EMPTY_PLAN_SLICE,
    blockers: [protocolPlanBlocker(code, reason, evidence)],
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
    scope: { kind: 'projection', id: STUDIO_GENERATED_PACKAGE_POLICY_PROJECTION_ID },
    evidence,
    reason,
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
