import type {
  ApmProjectFileSnapshot,
  ApmProjectionHandler,
  ApmProjectionInput,
  ApmProjectionPlanResult,
  ApmProjectMutation,
} from '@ankhorage/apm/types';
import { isRecord, isRecordOf, readOwnProperty } from '@ankhorage/utility/object';

import type {
  GeneratedPackageManifest,
  GeneratedPackagePolicy,
} from '../../../types/project-updates.js';
import { applyGeneratedPackagePolicy } from '../domain/applyGeneratedPackagePolicy.js';

/*** Bind the read-only package projection and reviewed writes to one exact Studio artifact. */
export function createGeneratedPackagePolicyProjection(
  options: PackagePolicyProjectionOptions,
): ApmProjectionHandler {
  return {
    id: PROJECTION_ID,
    inspectAsync: async (input) => {
      const state = await inspectProjectionStateAsync(input, options);
      return {
        projectionId: PROJECTION_ID,
        state:
          state.manifest === undefined
            ? 'unknown'
            : state.mutations.length === 0
              ? 'current'
              : 'stale',
        inputFingerprint: state.inputFingerprint,
        generatorFingerprint: state.generatorFingerprint,
        evidence: projectionEvidence(state),
        ...(state.manifest === undefined ? { reason: INVALID_PACKAGE_REASON } : {}),
      };
    },
    planAsync: async (input) => {
      const state = await inspectProjectionStateAsync(input, options);
      if (state.manifest === undefined) throw new Error(INVALID_PACKAGE_REASON);
      return toProjectionPlan(state);
    },
    materializeAsync: async (input) => {
      assertSelectedArtifact(input, options);
      if (
        input.plan.projectionId !== PROJECTION_ID ||
        input.plan.generatorFingerprint !== generatorFingerprint(input, options)
      ) {
        throw new Error('Studio package policy plan belongs to a different target artifact.');
      }
      // Every mutation writes the same package.json; never start another write before completion.
      for (const { id } of input.plan.mutations) {
        await input.project.applyReviewedMutationAsync(id);
      }
    },
    verifyAsync: async (input) => {
      const state = await inspectProjectionStateAsync(input, options);
      const generatorMatches = state.generatorFingerprint === input.plan.generatorFingerprint;
      const current = state.manifest !== undefined && state.mutations.length === 0;
      return {
        valid: current && generatorMatches,
        evidence: projectionEvidence(state),
        ...(!current || !generatorMatches
          ? {
              reason:
                'Studio package policy projection does not match the reviewed target artifact.',
            }
          : {}),
      };
    },
  };
}

interface PackagePolicyProjectionOptions {
  readonly policy: GeneratedPackagePolicy;
  readonly descriptorDigest: string;
  readonly digest: (value: string) => string;
}

interface ProjectionState {
  readonly manifest?: GeneratedPackageManifest;
  readonly inputFingerprint: string;
  readonly generatorFingerprint: string;
  readonly mutations: readonly ApmProjectMutation[];
}

const PROJECTION_ID = 'generated-package-policy';
const INVALID_PACKAGE_REASON =
  'Generated package.json is missing or does not match the Studio package-policy shape.';

/*** Inspect package policy state without mutating the project. */
async function inspectProjectionStateAsync(
  input: ApmProjectionInput,
  options: PackagePolicyProjectionOptions,
): Promise<ProjectionState> {
  assertSelectedArtifact(input, options);
  const snapshot = await input.project.readFileAsync('package.json');
  const manifest = parseGeneratedPackageManifest(snapshot);
  return {
    ...(manifest === undefined ? {} : { manifest }),
    inputFingerprint: snapshot.digest ?? options.digest(snapshot.content ?? 'missing:package.json'),
    generatorFingerprint: generatorFingerprint(input, options),
    mutations:
      manifest === undefined
        ? []
        : packagePolicyMutations(manifest, options.policy, snapshot.digest),
  };
}

/*** Refuse to substitute the running owner's policy for another selected target artifact. */
function assertSelectedArtifact(
  input: ApmProjectionInput,
  options: PackagePolicyProjectionOptions,
): void {
  const { context, descriptor } = input;
  if (
    descriptor.id !== PROJECTION_ID ||
    context.owner !== '@ankhorage/studio' ||
    context.artifact.packageName !== context.owner ||
    context.artifact.role !== 'target' ||
    context.targetVersion !== options.policy.ownerVersion ||
    context.artifact.version !== context.targetVersion ||
    context.artifact.descriptorDigest !== options.descriptorDigest ||
    context.artifact.integrity.trim() === ''
  ) {
    throw new Error(
      'Studio APM requires the exact selected target artifact; upgrade or restart the host instead of substituting its running policy.',
    );
  }
}

/*** Fingerprint the exact owner artifact and the policy that will produce the reviewed output. */
function generatorFingerprint(
  input: ApmProjectionInput,
  options: PackagePolicyProjectionOptions,
): string {
  return options.digest(
    JSON.stringify({
      owner: input.context.owner,
      targetVersion: input.context.targetVersion,
      integrity: input.context.artifact.integrity,
      descriptorDigest: options.descriptorDigest,
      policy: options.policy,
    }),
  );
}

/*** Convert inspected state into the reviewable APM projection plan. */
function toProjectionPlan(state: ProjectionState): ApmProjectionPlanResult {
  return {
    projectionId: PROJECTION_ID,
    mutations: state.mutations,
    inputFingerprint: state.inputFingerprint,
    generatorFingerprint: state.generatorFingerprint,
    evidence: projectionEvidence(state),
  };
}

/*** Build bounded evidence for package policy inspection and verification. */
function projectionEvidence(state: ProjectionState): readonly string[] {
  return [
    'package.json',
    `managed-fields:${state.mutations.length}`,
    `generator:${state.generatorFingerprint}`,
  ];
}

/*** Parse the minimum package manifest shape owned by Studio's generated package policy. */
function parseGeneratedPackageManifest(
  snapshot: ApmProjectFileSnapshot,
): GeneratedPackageManifest | undefined {
  if (!snapshot.exists || snapshot.content === undefined || snapshot.encoding === 'base64')
    return undefined;
  try {
    const value: unknown = JSON.parse(snapshot.content);
    if (!isRecord(value) || typeof value.packageManager !== 'string') return undefined;
    if (
      !isRecordOf(value.dependencies, (entry) => typeof entry === 'string') ||
      !isRecordOf(value.devDependencies, (entry) => typeof entry === 'string')
    ) {
      return undefined;
    }
    return {
      packageManager: value.packageManager,
      dependencies: value.dependencies,
      devDependencies: value.devDependencies,
    };
  } catch {
    return undefined;
  }
}

/*** Build reviewed JSON-pointer mutations only for fields Studio explicitly owns. */
function packagePolicyMutations(
  manifest: GeneratedPackageManifest,
  policy: GeneratedPackagePolicy,
  beforeDigest: string | undefined,
): readonly ApmProjectMutation[] {
  const target = applyGeneratedPackagePolicy(manifest, policy);
  const packageManager =
    manifest.packageManager === target.packageManager
      ? []
      : [stringMutation('/packageManager', target.packageManager, beforeDigest)];
  const sections = [
    { prefix: '/dependencies/', before: manifest.dependencies, after: target.dependencies },
    {
      prefix: '/devDependencies/',
      before: manifest.devDependencies,
      after: target.devDependencies,
    },
  ];
  const dependencies = sections.flatMap(({ prefix, before, after }) =>
    Object.entries(after).flatMap(([key, value]) =>
      readOwnProperty(before, key) === value
        ? []
        : [stringMutation(`${prefix}${jsonPointerSegment(key)}`, value, beforeDigest)],
    ),
  );
  return [...packageManager, ...dependencies];
}

/*** Build one reviewed string mutation with the matching narrow JSON-pointer ownership claim. */
function stringMutation(
  pointer: string,
  value: string,
  expectedBeforeDigest: string | undefined,
): ApmProjectMutation {
  return {
    id: `${PROJECTION_ID}:${pointer}`,
    claim: { kind: 'json-pointer', path: 'package.json', pointer },
    kind: 'set-json-pointer',
    path: 'package.json',
    pointer,
    value,
    ...(expectedBeforeDigest === undefined ? {} : { expectedBeforeDigest }),
  };
}

/*** Escape one JSON Pointer path segment according to RFC 6901. */
function jsonPointerSegment(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}
