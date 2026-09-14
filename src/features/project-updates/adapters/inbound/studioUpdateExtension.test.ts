import { readFile } from 'node:fs/promises';

import {
  validatePackageUpdateMetadata,
  validateUpdateDescriptor,
  validateUpdateExtensionBinding,
  validateUpdateExtensionCapabilities,
} from '@ankhorage/apm';
import type {
  ApmExtensionExecutionContext,
  ApmProjectFileSnapshot,
  ApmProjectionHandler,
  ApmUpdateDescriptor,
} from '@ankhorage/apm/types';
import { isRecord, readOwnProperty } from '@ankhorage/utility/object';
import { expect, test } from 'bun:test';

import studioUpdateExtension from '../../../../apm';
import { applyGeneratedPackagePolicy } from '../../domain/applyGeneratedPackagePolicy';
import { getGeneratedPackagePolicy } from '../outbound/getGeneratedPackagePolicy';

const PACKAGE_JSON_URL = new URL('../../../../../package.json', import.meta.url);
const DESCRIPTOR_URL = new URL('../../../../../apm/update.json', import.meta.url);

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
    descriptor: projectionDescriptor(),
    context,
    project,
  });
  const plan = await projection.planAsync({
    descriptor: projectionDescriptor(),
    context,
    project,
  });

  expect(inspection.state).toBe('stale');
  expect(plan.mutations.length).toBeGreaterThan(0);
  expect(plan.mutations.every(({ claim }) => descriptorOwnsClaim(claim))).toBe(true);
  expect(plan.mutations.some(({ id }) => id.includes('user-owned-package'))).toBe(false);
  expect(plan.mutations.some(({ id }) => id.includes('user-owned-dev-package'))).toBe(false);
  expect(plan.mutations).toContainEqual(
    expect.objectContaining({
      kind: 'set-json-pointer',
      pointer: '/dependencies/@ankhorage~1studio',
      value: policy.dependencies.studio,
    }),
  );
});

test('reports current policy and materializes only reviewed mutation ids', async () => {
  const projection = requirePackagePolicyProjection();
  const context = executionContext();
  const currentManifest = applyGeneratedPackagePolicy({
    packageManager: 'bun@0.0.1',
    dependencies: {
      '@ankhorage/studio': '^0.0.1',
      'user-owned-package': '^9.0.0',
    },
    devDependencies: {},
  });
  const currentProject = projectReadPort(currentManifest);
  const inspection = await projection.inspectAsync({
    descriptor: projectionDescriptor(),
    context,
    project: currentProject,
  });
  expect(inspection.state).toBe('current');

  const staleProject = projectReadPort({
    ...currentManifest,
    dependencies: { ...currentManifest.dependencies, '@ankhorage/contracts': '^0.0.1' },
  });
  const plan = await projection.planAsync({
    descriptor: projectionDescriptor(),
    context,
    project: staleProject,
  });
  const applied: string[] = [];
  await projection.materializeAsync({
    descriptor: projectionDescriptor(),
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

/*** Resolve the single executable Studio package-policy projection. */
function requirePackagePolicyProjection(): ApmProjectionHandler {
  const projection = studioUpdateExtension.projections.find(
    ({ id }) => id === 'generated-package-policy',
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

/*** Read the static descriptor used by the executable package-policy handler. */
function projectionDescriptor(): ApmUpdateDescriptor['projections'][number] {
  return {
    id: 'generated-package-policy',
    claims: descriptorClaims(),
    requiresExtension: true,
    reason: 'Studio owns generated application package policy for its managed dependency fields.',
  };
}

/*** Read declared projection claims from the shipped descriptor fixture. */
function descriptorClaims(): ApmUpdateDescriptor['projections'][number]['claims'] {
  const descriptor = JSON.parse(readFileSyncDescriptor()) as unknown;
  if (!isRecord(descriptor) || !Array.isArray(descriptor.projections)) {
    throw new Error('Studio APM descriptor must define projections.');
  }
  const projection = descriptor.projections.find(
    (value) => isRecord(value) && value.id === 'generated-package-policy',
  );
  if (!isRecord(projection) || !Array.isArray(projection.claims)) {
    throw new Error('Studio APM descriptor must define package-policy claims.');
  }
  return projection.claims as ApmUpdateDescriptor['projections'][number]['claims'];
}

/*** Return whether the static descriptor contains an exact reviewed mutation claim. */
function descriptorOwnsClaim(claim: ApmUpdateDescriptor['projections'][number]['claims'][number]): boolean {
  return descriptorClaims().some((candidate) => JSON.stringify(candidate) === JSON.stringify(claim));
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

/*** Read the descriptor synchronously for pure claim lookup helpers. */
function readFileSyncDescriptor(): string {
  return Bun.file(DESCRIPTOR_URL).text() as unknown as string;
}
