import type {
  ApmExtensionArtifactIdentity,
  ApmPlanBlocker,
  ApmPlanPackageSelection,
  ApmPlanProtocolPort,
  ApmPlanProtocolRequest,
  ApmPlanProtocolResult,
  ApmPlanStep,
  ApmProjectionDescriptor,
  ApmProjectionPlanResult,
  ApmProjectMutation,
  ApmStatusDependency,
} from '@ankhorage/apm/types';
import {
  compareSemanticVersions,
  parseSemanticVersion,
  satisfiesCaretSemverRange,
} from '@ankhorage/utility/semver';

import type { StudioGeneratedPackagePolicySource } from '../../../types/project-updates';
import { createStudioGeneratedPackagePolicyProjectReadPort } from '../adapters/outbound/createStudioGeneratedPackagePolicyProjectReadPort';
import { readStudioGeneratedPackagePolicyHandler } from '../adapters/outbound/readStudioGeneratedPackagePolicyHandler';
import { readStudioGeneratedPackagePolicyProjectionDescriptor } from '../adapters/outbound/readStudioGeneratedPackagePolicyProjectionDescriptor';
import type { resolveCurrentStudioApmArtifactAsync } from '../adapters/outbound/resolveCurrentStudioApmArtifactAsync';
import { STUDIO_GENERATED_PACKAGE_POLICY_PROJECTION_ID, STUDIO_PACKAGE_NAME } from '../constants';
import { createStudioGeneratedPackagePolicyExecutionContext } from '../domain/createStudioGeneratedPackagePolicyExecutionContext';
import { readManagedPackageRangeFloor } from '../domain/readManagedPackageRangeFloor';
import { readStudioGeneratedPackagePolicyMutationTarget } from '../domain/readStudioGeneratedPackagePolicyMutationTarget';
import { readStudioGeneratedPackagePolicyStatusSource } from '../domain/readStudioGeneratedPackagePolicyStatusSource';

interface GeneratedPolicyPlanSlice {
  readonly requiredSelections: readonly ApmPlanPackageSelection[];
  readonly steps: readonly ApmPlanStep[];
  readonly blockers: readonly ApmPlanBlocker[];
}

interface SelectionResolution {
  readonly selection?: ApmPlanPackageSelection;
  readonly blocker?: ApmPlanBlocker;
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
      const policySlice = needsPackagePolicyPlan(input)
        ? await planGeneratedPolicyAsync(input, resolveArtifactAsync)
        : EMPTY_PLAN_SLICE;
      const blockers = [...baseResult.blockers, ...policySlice.blockers];
      return {
        ...baseResult,
        complete: baseResult.complete && blockers.length === 0,
        requiredSelections: [...baseResult.requiredSelections, ...policySlice.requiredSelections],
        steps: [...baseResult.steps, ...policySlice.steps],
        blockers,
      };
    },
  };
}

/*** Return whether current owner evidence requires generated package-policy repair. */
function needsPackagePolicyPlan(input: ApmPlanProtocolRequest): boolean {
  if (!input.policy.repairProjections) return false;
  return input.status.extensions.observations.some(
    (observation) =>
      observation.owner === STUDIO_PACKAGE_NAME &&
      observation.projection === 'stale' &&
      observation.evidence.includes(`projection:${STUDIO_GENERATED_PACKAGE_POLICY_PROJECTION_ID}`),
  );
}

/*** Resolve source and target owner identities before planning the reviewed projection. */
async function planGeneratedPolicyAsync(
  input: ApmPlanProtocolRequest,
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
  return planResolvedPolicyAsync(input, source, artifactResolution.artifact);
}

/*** Plan exact target-owner policy and derive native dependency selections from reviewed mutations. */
async function planResolvedPolicyAsync(
  input: ApmPlanProtocolRequest,
  source: StudioGeneratedPackagePolicySource,
  artifact: ApmExtensionArtifactIdentity,
): Promise<GeneratedPolicyPlanSlice> {
  const context = createStudioGeneratedPackagePolicyExecutionContext(source.version, artifact);
  const descriptor = readStudioGeneratedPackagePolicyProjectionDescriptor();
  const plan = await readStudioGeneratedPackagePolicyHandler().planAsync({
    descriptor,
    context,
    project: createStudioGeneratedPackagePolicyProjectReadPort(input.status.rootPath),
  });
  const selectionResult = requiredSelections(input.status.dependencies, source, plan.mutations);
  if (selectionResult.blockers.length > 0) {
    return { ...EMPTY_PLAN_SLICE, blockers: selectionResult.blockers };
  }
  return {
    requiredSelections: selectionResult.selections,
    steps: [projectionStep(source, artifact, descriptor, plan)],
    blockers: [],
  };
}

/*** Build the reviewed Studio generated-package-policy projection step. */
function projectionStep(
  source: StudioGeneratedPackagePolicySource,
  artifact: ApmExtensionArtifactIdentity,
  descriptor: ApmProjectionDescriptor,
  plan: ApmProjectionPlanResult,
): ApmPlanStep {
  return {
    id: `projection:${STUDIO_PACKAGE_NAME}:${STUDIO_GENERATED_PACKAGE_POLICY_PROJECTION_ID}`,
    kind: 'projection',
    prerequisites: [],
    owner: STUDIO_PACKAGE_NAME,
    reason: 'Reconcile generated package policy to the exact running Studio owner artifact.',
    evidence: [`source:${source.version}`, `target:${artifact.version}`, ...plan.evidence],
    execution: { kind: 'projection', descriptor, artifact, plan },
  };
}

interface RequiredSelectionResult {
  readonly selections: readonly ApmPlanPackageSelection[];
  readonly blockers: readonly ApmPlanBlocker[];
}

/*** Convert reviewed dependency-range mutations into exact safe APM dependency selections. */
function requiredSelections(
  dependencies: readonly ApmStatusDependency[],
  source: StudioGeneratedPackagePolicySource,
  mutations: readonly ApmProjectMutation[],
): RequiredSelectionResult {
  return mutations.reduce<RequiredSelectionResult>(
    (result, mutation) => {
      const resolved = selectionForMutation(dependencies, source, mutation);
      return {
        selections:
          resolved.selection === undefined
            ? result.selections
            : [...result.selections, resolved.selection],
        blockers:
          resolved.blocker === undefined ? result.blockers : [...result.blockers, resolved.blocker],
      };
    },
    { selections: [], blockers: [] },
  );
}

/*** Resolve one reviewed dependency mutation to a package selection or explicit blocker. */
function selectionForMutation(
  dependencies: readonly ApmStatusDependency[],
  source: StudioGeneratedPackagePolicySource,
  mutation: ApmProjectMutation,
): SelectionResolution {
  const target = readStudioGeneratedPackagePolicyMutationTarget(mutation);
  if (
    target === undefined ||
    target.section === 'packageManager' ||
    mutation.kind !== 'set-json-pointer' ||
    typeof mutation.value !== 'string'
  ) {
    return {};
  }
  const matches = matchingDependencies(dependencies, source, target.name);
  const [dependency] = matches;
  if (matches.length !== 1 || dependency?.declaration === undefined) {
    return {
      blocker: missingDependencyBlocker(target.name, matches.length),
    };
  }
  const { declaration } = dependency;
  if (declaration.range === mutation.value) return {};
  return selectionForRange(dependency, declaration.ownerPath, mutation.value);
}

/*** Find one managed declaration only inside the generated app's Studio install root and owner manifest. */
function matchingDependencies(
  dependencies: readonly ApmStatusDependency[],
  source: StudioGeneratedPackagePolicySource,
  name: string,
): readonly ApmStatusDependency[] {
  return dependencies.filter(
    (dependency) =>
      dependency.direct &&
      dependency.installRootId === source.installRootId &&
      dependency.name === name &&
      dependency.declaration?.ownerPath === source.ownerPath,
  );
}

/*** Build an exact target selection for one changed managed dependency range. */
function selectionForRange(
  dependency: ApmStatusDependency,
  ownerPath: string,
  range: string,
): SelectionResolution {
  const targetVersion = newestKnownVersionInRange(dependency, range) ?? readManagedPackageRangeFloor(range);
  if (targetVersion === undefined) {
    return {
      blocker: unsupportedRangeBlocker(dependency.name, range),
    };
  }
  return {
    selection: {
      selector: {
        name: dependency.name,
        packageId: dependency.packageId,
        installRootId: dependency.installRootId,
        ownerPath,
      },
      target: { kind: 'version', version: targetVersion, manifestRange: range },
    },
  };
}

/*** Explain a managed dependency required by Studio but missing from the generated app declaration set. */
function missingDependencyBlocker(name: string, matches: number): ApmPlanBlocker {
  return protocolPlanBlocker(
    'protocol.studio-generated-package-policy-dependency-missing',
    `Studio package policy requires managed dependency ${name}, but the current generated app does not expose one unique direct declaration.`,
    [name, `matches:${matches}`],
  );
}

/*** Explain a managed Studio range shape APM cannot safely turn into an exact native target. */
function unsupportedRangeBlocker(name: string, range: string): ApmPlanBlocker {
  return protocolPlanBlocker(
    'protocol.studio-generated-package-policy-range-unsupported',
    `Studio generated package policy uses an unsupported managed dependency range for ${name}.`,
    [name, range],
  );
}

/*** Select the highest known current/registry version admitted by the target Studio range. */
function newestKnownVersionInRange(
  dependency: ApmStatusDependency,
  range: string,
): string | undefined {
  const candidates = [
    dependency.availability.latestVersion,
    dependency.availability.compatibleVersion,
    dependency.lockedVersion,
    dependency.installed.version,
  ].filter(
    (value): value is string => value !== undefined && versionSatisfiesManagedRange(value, range),
  );
  return candidates.reduce<string | undefined>((selected, candidate) => {
    if (selected === undefined) return candidate;
    const left = parseSemanticVersion(selected);
    const right = parseSemanticVersion(candidate);
    if (left === null || right === null) return selected;
    return compareSemanticVersions(right, left) > 0 ? candidate : selected;
  }, undefined);
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
