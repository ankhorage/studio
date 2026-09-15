import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

import {
  resolveMigrationPath,
  validatePackageUpdateMetadata,
  validateUpdateDescriptor,
  validateUpdateExtensionBinding,
  validateUpdateExtensionCapabilities,
} from '@ankhorage/apm';
import type {
  ApmExtensionExecutionContext,
  ApmProjectFileSnapshot,
  ApmProjectionHandler,
  ApmProjectScope,
  ApmUpdateDescriptor,
} from '@ankhorage/apm/types';
import { isRecord, readOwnProperty } from '@ankhorage/utility/object';
import { expect, test } from 'bun:test';

import studioUpdateExtension from '../../../../apm';
import { applyGeneratedPackagePolicy } from '../../domain/applyGeneratedPackagePolicy';
import { getGeneratedPackagePolicy } from '../outbound/getGeneratedPackagePolicy';

const PACKAGE_JSON_URL = new URL('../../../../../package.json', import.meta.url);
const DESCRIPTOR_URL = new URL('../../../../../apm/update.json', import.meta.url);
const PACKAGE_POLICY_PROJECTION = readPackagePolicyProjection();

test('publishes valid APM metadata bound to the exact Studio artifact', async () => {
  const packageJson = await readJsonRecordAsync(PACKAGE_JSON_URL);
  const descriptorJson: unknown = JSON.parse(await readFile(DESCRIPTOR_URL, 'utf8'));
  const metadata = readOwnProperty(readRequiredRecord(packageJson, 'ankh'), 'apm');
  const metadataValidation = validatePackageUpdateMetadata(metadata);
  const owner = {
    name: readRequiredString(packageJson, 'name'),
    version: readRequiredString(packageJson, 'version'),
  };
  const descriptorValidation = validateUpdateDescriptor({
    descriptor: descriptorJson,
    expectedOwner: owner,
  });

  expect(metadataValidation.valid).toBe(true);
  expect(descriptorValidation.valid).toBe(true);
  expect(descriptorValidation.blockers).toEqual([]);
  if (descriptorValidation.descriptor === undefined) return;

  const artifact = {
    role: 'target' as const,
    packageName: owner.name,
    version: owner.version,
    integrity: 'sha512-studio-test-artifact',
    descriptorDigest: studioUpdateExtension.descriptorDigest,
  };
  expect(validateUpdateExtensionBinding(artifact, studioUpdateExtension)).toEqual([]);
  expect(
    validateUpdateExtensionCapabilities(
      descriptorValidation.descriptor,
      artifact,
      studioUpdateExtension,
    ),
  ).toEqual([]);
});

test('plans only Studio-owned package fields and preserves user dependencies', async () => {
  const policy = getGeneratedPackagePolicy();
  const staleManifest = {
    packageManager: 'bun@0.0.1',
    dependencies: {
      '@ankhorage/contracts': '^0.0.1',
      '@ankhorage/studio': '^0.0.1',
      'user-owned-package': '^9.0.0',
    },
    devDependencies: {
      '@ankhorage/devtools': '^0.0.1',
      'user-owned-dev-package': '^4.0.0',
    },
  };
  const projection = requirePackagePolicyProjection();
  const context = executionContext();
  const project = projectReadPort(staleManifest);
  const inspection = await projection.inspectAsync({
    descriptor: PACKAGE_POLICY_PROJECTION,
    context,
    project,
  });
  const plan = await projection.planAsync({
    descriptor: PACKAGE_POLICY_PROJECTION,
    context,
    project,
  });

  expect(inspection.state).toBe('stale');
  expect(plan.mutations.length).toBeGreaterThan(0);
  expect(plan.mutations.every(({ claim }) => descriptorOwnsClaim(claim))).toBe(true);
  expect(plan.mutations.some(({ id }) => id.includes('user-owned-package'))).toBe(false);
  expect(plan.mutations.some(({ id }) => id.includes('user-owned-dev-package'))).toBe(false);
  const studioMutation = plan.mutations.find(
    (mutation) =>
      mutation.kind === 'set-json-pointer' &&
      mutation.pointer === '/dependencies/@ankhorage~1studio',
  );
  expect(studioMutation).toBeDefined();
  if (studioMutation?.kind !== 'set-json-pointer') return;
  expect(studioMutation.value).toBe(policy.dependencies.studio);
});

test('reports current policy and materializes only reviewed mutation ids', async () => {
  const projection = requirePackagePolicyProjection();
  const context = executionContext();
  const currentManifest = applyGeneratedPackagePolicy(
    {
      packageManager: 'bun@0.0.1',
      dependencies: {
        '@ankhorage/studio': '^0.0.1',
        'user-owned-package': '^9.0.0',
      },
      devDependencies: {},
    },
    getGeneratedPackagePolicy(),
  );
  const currentProject = projectReadPort(currentManifest);
  const inspection = await projection.inspectAsync({
    descriptor: PACKAGE_POLICY_PROJECTION,
    context,
    project: currentProject,
  });
  expect(inspection.state).toBe('current');

  const staleProject = projectReadPort({
    ...currentManifest,
    dependencies: { ...currentManifest.dependencies, '@ankhorage/contracts': '^0.0.1' },
  });
  const plan = await projection.planAsync({
    descriptor: PACKAGE_POLICY_PROJECTION,
    context,
    project: staleProject,
  });
  const applied: string[] = [];
  await projection.materializeAsync({
    descriptor: PACKAGE_POLICY_PROJECTION,
    context,
    plan,
    project: {
      ...staleProject,
      applyReviewedMutationAsync: (mutationId) => {
        applied.push(mutationId);
        return Promise.resolve();
      },
    },
  });
  expect(applied).toEqual(plan.mutations.map(({ id }) => id));
});

test('rejects malformed package state during planning instead of returning an empty plan', async () => {
  const projection = requirePackagePolicyProjection();
  const input = {
    descriptor: PACKAGE_POLICY_PROJECTION,
    context: executionContext(),
    project: projectReadPort({ packageManager: 'bun@0.0.1', dependencies: [] }),
  };
  expect((await projection.inspectAsync(input)).state).toBe('unknown');
  await expectFailureAsync(projection.planAsync(input), 'package.json');
});

test('executes reviewed package mutations serially and stops on the first failed write', async () => {
  const projection = requirePackagePolicyProjection();
  const context = executionContext();
  const project = projectReadPort({
    packageManager: 'bun@0.0.1',
    dependencies: {},
    devDependencies: {},
  });
  const input = { descriptor: PACKAGE_POLICY_PROJECTION, context, project };
  const plan = await projection.planAsync(input);
  const [first] = plan.mutations;
  if (first === undefined) throw new Error('Expected multiple package mutations.');
  expect(plan.mutations.length).toBeGreaterThan(1);
  const writes: string[] = [];
  await expectFailureAsync(
    projection.materializeAsync({
      ...input,
      plan,
      project: {
        ...project,
        applyReviewedMutationAsync: async (id) => {
          writes.push(id);
          await Promise.resolve();
          throw new Error('interrupted write');
        },
      },
    }),
    'interrupted write',
  );
  expect(writes).toEqual([first.id]);
});

test('verification rejects stale output and a different generator artifact', async () => {
  const projection = requirePackagePolicyProjection();
  const policy = getGeneratedPackagePolicy();
  const stale = { packageManager: 'bun@0.0.1', dependencies: {}, devDependencies: {} };
  const input = {
    descriptor: PACKAGE_POLICY_PROJECTION,
    context: executionContext(),
    project: { ...projectReadPort(stale), applyReviewedMutationAsync: () => Promise.resolve() },
  };
  const plan = await projection.planAsync(input);
  expect((await projection.verifyAsync({ ...input, plan })).valid).toBe(false);
  const current = {
    ...input,
    project: {
      ...projectReadPort(applyGeneratedPackagePolicy(stale, policy)),
      applyReviewedMutationAsync: () => Promise.resolve(),
    },
  };
  expect((await projection.verifyAsync({ ...current, plan })).valid).toBe(true);
  expect((await projection.planAsync(current)).mutations).toEqual([]);
  expect(
    (
      await projection.verifyAsync({
        ...current,
        plan: { ...plan, generatorFingerprint: 'different-artifact' },
      })
    ).valid,
  ).toBe(false);
});

test('keeps disabled optional capabilities absent during package projection', async () => {
  const projection = requirePackagePolicyProjection();
  const plan = await projection.planAsync({
    descriptor: PACKAGE_POLICY_PROJECTION,
    context: executionContext(),
    project: projectReadPort({
      packageManager: 'bun@0.0.1',
      dependencies: {},
      devDependencies: {},
    }),
  });
  const optional = ['studio', 'utility', 'supabase-auth', 'supabase-storage'];
  for (const name of optional) {
    expect(
      plan.mutations.some(
        (mutation) =>
          mutation.kind === 'set-json-pointer' &&
          mutation.pointer === `/dependencies/@ankhorage~1${name}`,
      ),
    ).toBe(false);
  }
});

test('declares supported skipped-version history and rejects unreviewed older states', () => {
  const descriptorJson: unknown = JSON.parse(readFileSync(DESCRIPTOR_URL, 'utf8'));
  const validation = validateUpdateDescriptor({ descriptor: descriptorJson });
  const { descriptor } = validation;
  if (!validation.valid || descriptor === undefined) throw new Error('Invalid owner descriptor.');
  const targetVersion = getGeneratedPackagePolicy().ownerVersion;
  const supported = resolveMigrationPath({ descriptor, sourceVersion: '2.5.7', targetVersion });
  expect(supported.supported).toBe(true);
  expect(supported.noMigrationRequired).toBe(true);
  const unsupported = resolveMigrationPath({ descriptor, sourceVersion: '1.0.0', targetVersion });
  expect(unsupported.supported).toBe(false);
  expect(unsupported.blockers.some(({ code }) => code === 'protocol.history-unsupported')).toBe(
    true,
  );
});

test('refuses another selected owner version instead of using the running host policy', async () => {
  const projection = requirePackagePolicyProjection();
  const context = executionContext();
  const input = {
    descriptor: PACKAGE_POLICY_PROJECTION,
    context: { ...context, targetVersion: `${context.targetVersion}-different` },
    project: projectReadPort({
      packageManager: 'bun@0.0.1',
      dependencies: {},
      devDependencies: {},
    }),
  };
  await expectFailureAsync(projection.planAsync(input), 'exact selected target artifact');
});

test('refuses mismatched descriptor identity before any project read', async () => {
  const projection = requirePackagePolicyProjection();
  const context = executionContext();
  const reads: string[] = [];
  const input = {
    descriptor: PACKAGE_POLICY_PROJECTION,
    context: {
      ...context,
      artifact: { ...context.artifact, descriptorDigest: 'different-descriptor' },
    },
    project: {
      ...projectReadPort({}),
      readFileAsync: (path: string) => {
        reads.push(path);
        return Promise.resolve({ path, exists: false });
      },
    },
  };
  await expectFailureAsync(projection.planAsync(input), 'exact selected target artifact');
  expect(reads).toEqual([]);
});

test('refuses a plan from another generator before any reviewed write', async () => {
  const projection = requirePackagePolicyProjection();
  const input = {
    descriptor: PACKAGE_POLICY_PROJECTION,
    context: executionContext(),
    project: projectReadPort({
      packageManager: 'bun@0.0.1',
      dependencies: {},
      devDependencies: {},
    }),
  };
  const plan = await projection.planAsync(input);
  const writes: string[] = [];
  await expectFailureAsync(
    projection.materializeAsync({
      ...input,
      plan: { ...plan, generatorFingerprint: 'different-generator' },
      project: {
        ...input.project,
        applyReviewedMutationAsync: (id) => {
          writes.push(id);
          return Promise.resolve();
        },
      },
    }),
    'different target artifact',
  );
  expect(writes).toEqual([]);
});

/*** Resolve the single executable Studio package-policy projection. */
function requirePackagePolicyProjection(): ApmProjectionHandler {
  const projection = studioUpdateExtension.projections.find(
    ({ id }) => id === PACKAGE_POLICY_PROJECTION.id,
  );
  if (projection === undefined) throw new Error('Studio package-policy projection is missing.');
  return projection;
}

/*** Build an exact target-artifact execution context for the current Studio package. */
function executionContext(): ApmExtensionExecutionContext {
  const policy = getGeneratedPackagePolicy();
  return {
    owner: '@ankhorage/studio',
    sourceVersion: policy.ownerVersion,
    targetVersion: policy.ownerVersion,
    artifact: {
      role: 'target',
      packageName: '@ankhorage/studio',
      version: policy.ownerVersion,
      integrity: 'sha512-studio-test-artifact',
      descriptorDigest: studioUpdateExtension.descriptorDigest,
    },
  };
}

/*** Read and validate the package-policy descriptor shipped in the Studio package artifact. */
function readPackagePolicyProjection(): ApmUpdateDescriptor['projections'][number] {
  const descriptorJson: unknown = JSON.parse(readFileSync(DESCRIPTOR_URL, 'utf8'));
  const validation = validateUpdateDescriptor({ descriptor: descriptorJson });
  const projection = validation.descriptor?.projections.find(
    ({ id }) => id === 'generated-package-policy',
  );
  if (projection === undefined) {
    throw new Error('Studio APM descriptor must define generated-package-policy.');
  }
  return projection;
}

/*** Return whether the static descriptor contains an exact reviewed mutation claim. */
function descriptorOwnsClaim(claim: ApmProjectScope): boolean {
  return PACKAGE_POLICY_PROJECTION.claims.some(
    (candidate) => JSON.stringify(candidate) === JSON.stringify(claim),
  );
}

/*** Build a deterministic read-only project adapter around one package manifest. */
function projectReadPort(manifest: object) {
  const content = `${JSON.stringify(manifest, null, 2)}\n`;
  const snapshot: ApmProjectFileSnapshot = {
    path: 'package.json',
    exists: true,
    digest: `fixture:${content.length}`,
    encoding: 'utf8',
    content,
  };
  return {
    readFileAsync: () => Promise.resolve(snapshot),
    listFilesAsync: () => Promise.resolve([]),
  };
}

/*** Read one JSON object fixture. */
async function readJsonRecordAsync(url: URL): Promise<Readonly<Record<string, unknown>>> {
  const value: unknown = JSON.parse(await readFile(url, 'utf8'));
  if (!isRecord(value)) throw new Error(`${url.pathname} must contain an object.`);
  return value;
}

/*** Read one required nested object property. */
function readRequiredRecord(
  value: Readonly<Record<string, unknown>>,
  key: string,
): Readonly<Record<string, unknown>> {
  const property = readOwnProperty(value, key);
  if (!isRecord(property)) throw new Error(`package.json must define object ${key}.`);
  return property;
}

/*** Read one required string property. */
function readRequiredString(value: Readonly<Record<string, unknown>>, key: string): string {
  const property = readOwnProperty(value, key);
  if (typeof property !== 'string') throw new Error(`package.json must define string ${key}.`);
  return property;
}

/*** Await the actual operation rejection before inspecting boundary calls and its diagnostic. */
async function expectFailureAsync(operation: Promise<unknown>, message: string): Promise<void> {
  const error: unknown = await operation.then(
    () => undefined,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(Error);
  if (!(error instanceof Error)) throw new Error('Expected operation to reject.');
  expect(error.message).toContain(message);
}
