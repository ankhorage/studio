import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import type {
  ApmProjectFileSnapshot,
  ApmProjectMutation,
  ApmProjectionHandler,
  ApmProjectionInput,
  ApmProjectionPlanResult,
  ApmUpdateExtension,
} from '@ankhorage/apm/types';
import { isRecord } from '@ankhorage/utility/object';

import type {
  GeneratedPackageManifest,
  GeneratedPackagePolicy,
} from '../../../../types/project-updates';
import { getGeneratedPackagePolicy } from '../outbound/getGeneratedPackagePolicy';

/*** Expose Studio's trusted package-policy projection through the public APM extension contract. */
export const studioUpdateExtension: ApmUpdateExtension = {
  protocolVersion: 1,
  descriptorDigest: readDescriptorDigest(),
  migrations: [],
  projections: [createGeneratedPackagePolicyProjection()],
};

interface ManagedPolicyEntry {
  readonly section: 'dependencies' | 'devDependencies';
  readonly key: string;
  readonly target: string;
}

interface ProjectionState {
  readonly snapshot: ApmProjectFileSnapshot;
  readonly manifest?: GeneratedPackageManifest;
  readonly inputFingerprint: string;
  readonly generatorFingerprint: string;
  readonly mutations: readonly ApmProjectMutation[];
}

/*** Build the executable projection handler owned by the exact Studio artifact that exports it. */
function createGeneratedPackagePolicyProjection(): ApmProjectionHandler {
  return {
    id: projectionId(),
    inspectAsync: async (input) => {
      const state = await inspectProjectionStateAsync(input);
      return {
        projectionId: projectionId(),
        state:
          state.manifest === undefined
            ? 'unknown'
            : state.mutations.length === 0
              ? 'current'
              : 'stale',
        inputFingerprint: state.inputFingerprint,
        generatorFingerprint: state.generatorFingerprint,
        evidence: projectionEvidence(state),
        ...(state.manifest === undefined
          ? {
              reason:
                'Generated package.json is missing or does not match the Studio package-policy shape.',
            }
          : {}),
      };
    },
    planAsync: async (input) => {
      const state = await inspectProjectionStateAsync(input);
      return toProjectionPlan(state);
    },
    materializeAsync: async (input) => {
      await Promise.all(
        input.plan.mutations.map(({ id }) => input.project.applyReviewedMutationAsync(id)),
      );
    },
    verifyAsync: async (input) => {
      const state = await inspectProjectionStateAsync(input);
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

/*** Inspect package policy state without mutating the project. */
async function inspectProjectionStateAsync(input: ApmProjectionInput): Promise<ProjectionState> {
  const snapshot = await input.project.readFileAsync('package.json');
  const policy = getGeneratedPackagePolicy();
  const manifest = parseGeneratedPackageManifest(snapshot);
  const generatorFingerprint = sha256(
    JSON.stringify({
      owner: input.context.owner,
      targetVersion: input.context.targetVersion,
      integrity: input.context.artifact.integrity,
      descriptorDigest: input.context.artifact.descriptorDigest,
      policy,
    }),
  );
  return {
    snapshot,
    ...(manifest === undefined ? {} : { manifest }),
    inputFingerprint: snapshot.digest ?? sha256(snapshot.content ?? 'missing:package.json'),
    generatorFingerprint,
    mutations:
      manifest === undefined ? [] : packagePolicyMutations(manifest, policy, snapshot.digest),
  };
}

/*** Convert inspected state into the reviewable APM projection plan. */
function toProjectionPlan(state: ProjectionState): ApmProjectionPlanResult {
  return {
    projectionId: projectionId(),
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
  if (!snapshot.exists || snapshot.content === undefined) return undefined;
  try {
    const value: unknown = JSON.parse(snapshot.content);
    if (!isRecord(value) || typeof value.packageManager !== 'string') return undefined;
    if (!isStringRecord(value.dependencies) || !isStringRecord(value.devDependencies)) {
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

/*** Return whether every own value of one record is a string. */
function isStringRecord(value: unknown): value is Readonly<Record<string, string>> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');
}

/*** Build reviewed JSON-pointer mutations only for fields Studio explicitly owns. */
function packagePolicyMutations(
  manifest: GeneratedPackageManifest,
  policy: GeneratedPackagePolicy,
  beforeDigest: string | undefined,
): readonly ApmProjectMutation[] {
  const packageManagerMutation =
    manifest.packageManager === policy.packageManager
      ? []
      : [stringMutation('/packageManager', policy.packageManager, beforeDigest)];
  const managed = managedPolicyEntries(manifest, policy).flatMap((entry) => {
    const current = manifest[entry.section][entry.key];
    return current === entry.target
      ? []
      : [
          stringMutation(
            `/${entry.section}/${jsonPointerSegment(entry.key)}`,
            entry.target,
            beforeDigest,
          ),
        ];
  });
  return [...packageManagerMutation, ...managed];
}

/*** Enumerate package fields controlled by this Studio artifact while preserving optional capabilities. */
function managedPolicyEntries(
  manifest: GeneratedPackageManifest,
  policy: GeneratedPackagePolicy,
): readonly ManagedPolicyEntry[] {
  const dependencies: readonly ManagedPolicyEntry[] = [
    dependency('@ankhorage/contracts', policy.dependencies.contracts),
    dependency('@ankhorage/data-sources', policy.dependencies.dataSources),
    dependency('@ankhorage/expo-runtime', policy.dependencies.expoRuntime),
    dependency('@ankhorage/navigator', policy.dependencies.navigator),
    dependency('@ankhorage/runtime', policy.dependencies.runtime),
    ...optionalDependency(manifest, '@ankhorage/studio', policy.dependencies.studio),
    ...optionalDependency(manifest, '@ankhorage/utility', policy.dependencies.utility),
    ...optionalDependency(manifest, '@ankhorage/supabase-auth', policy.dependencies.supabaseAuth),
    ...optionalDependency(
      manifest,
      '@ankhorage/supabase-storage',
      policy.dependencies.supabaseStorage,
    ),
    dependency('@ankhorage/zora', policy.dependencies.zora),
    dependency('@react-native-picker/picker', policy.peerDependencies.nativePicker),
    dependency('@react-native-vector-icons/fontawesome', policy.peerDependencies.fontawesome),
    dependency('@react-native-vector-icons/fontawesome5', policy.peerDependencies.fontawesome5),
    dependency('@react-native-vector-icons/fontawesome6', policy.peerDependencies.fontawesome6),
    dependency('@react-native-vector-icons/ionicons', policy.peerDependencies.ionicons),
  ];
  const devDependencies: readonly ManagedPolicyEntry[] = [
    devDependency('@ankhorage/ankh', policy.devDependencies.ankh),
    devDependency('@ankhorage/devtools', policy.devDependencies.devtools),
    devDependency('@types/bun', policy.devDependencies.typesBun),
    devDependency('@types/culori', policy.devDependencies.typesCulori),
    devDependency('@types/react', policy.devDependencies.typesReact),
  ];
  return [...dependencies, ...devDependencies];
}

/*** Build one required generated runtime dependency policy entry. */
function dependency(key: string, target: string): ManagedPolicyEntry {
  return { section: 'dependencies', key, target };
}

/*** Build one generated development dependency policy entry. */
function devDependency(key: string, target: string): ManagedPolicyEntry {
  return { section: 'devDependencies', key, target };
}

/*** Preserve capability-driven optional dependencies unless the app already owns that capability. */
function optionalDependency(
  manifest: GeneratedPackageManifest,
  key: string,
  target: string,
): readonly ManagedPolicyEntry[] {
  return key in manifest.dependencies ? [dependency(key, target)] : [];
}

/*** Build one reviewed string mutation with the matching narrow JSON-pointer ownership claim. */
function stringMutation(
  pointer: string,
  value: string,
  expectedBeforeDigest: string | undefined,
): ApmProjectMutation {
  return {
    id: `${projectionId()}:${pointer}`,
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

/*** Return the stable Studio package-policy projection identity. */
function projectionId(): string {
  return 'generated-package-policy';
}

/*** Read the exact static descriptor bytes shipped with this Studio artifact and hash them. */
function readDescriptorDigest(): string {
  const descriptorUrl = new URL('../../../../../apm/update.json', import.meta.url);
  return sha256(readFileSync(descriptorUrl, 'utf8'));
}

/*** Return one stable SHA-256 hex digest. */
function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
