import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import process from 'node:process';

import type { ApmExtensionProjectReadPort, ApmProjectMutation } from '@ankhorage/apm/types';

// A headless owner import must not pull in Studio UI or any native peer graph.
registerHooks({
  resolve(specifier, context, nextResolve) {
    assert.ok(
      !/^(?:react(?:-native|-dom)?(?:\/|$)|expo(?:[-/]|$)|@ankhorage\/(?:zora|surface)(?:[-/]|$))/u.test(
        specifier,
      ),
      `Headless APM owner imported UI/native peer: ${specifier}`,
    );
    return nextResolve(specifier, context);
  },
});

const {
  resolveMigrationPath,
  validateUpdateDescriptor,
  validateUpdateExtensionBinding,
  validateUpdateExtensionCapabilities,
} = await import('@ankhorage/apm');
const { isRecord, readOwnProperty } = await import('@ankhorage/utility/object');
const { default: extension } = await import('@ankhorage/studio/apm');
const entryUrl = import.meta.resolve('@ankhorage/studio/apm');
const packageJson: unknown = JSON.parse(
  await readFile(new URL('../package.json', entryUrl), 'utf8'),
);
assert.ok(isRecord(packageJson));
assert.equal(packageJson.name, '@ankhorage/studio');
assert.equal(typeof packageJson.version, 'string');
if (typeof packageJson.version !== 'string') throw new Error('Missing Studio version.');
const descriptorSource = await readFile(new URL('../apm/update.json', entryUrl), 'utf8');
const descriptorJson: unknown = JSON.parse(descriptorSource);
const validation = validateUpdateDescriptor({
  descriptor: descriptorJson,
  expectedOwner: { name: '@ankhorage/studio', version: packageJson.version },
});
assert.equal(validation.valid, true, JSON.stringify(validation.blockers));
const { descriptor } = validation;
if (descriptor === undefined) throw new Error('Missing validated descriptor.');
const integrity: unknown = process.env.STUDIO_ARTIFACT_INTEGRITY;
if (typeof integrity !== 'string' || !integrity.startsWith('sha512-')) {
  throw new Error('The harness must supply the exact tarball integrity.');
}
const artifact = {
  role: 'target' as const,
  packageName: '@ankhorage/studio',
  version: packageJson.version,
  integrity,
  descriptorDigest: createHash('sha256').update(descriptorSource).digest('hex'),
};
assert.deepEqual(validateUpdateExtensionBinding(artifact, extension), []);
assert.deepEqual(validateUpdateExtensionCapabilities(descriptor, artifact, extension), []);
const path = resolveMigrationPath({
  descriptor,
  sourceVersion: '2.5.7',
  targetVersion: packageJson.version,
});
assert.equal(path.supported, true);
assert.equal(path.noMigrationRequired, true);
assert.equal(
  resolveMigrationPath({ descriptor, sourceVersion: '1.0.0', targetVersion: packageJson.version })
    .supported,
  false,
);
const projectionDescriptor = descriptor.projections.find(
  ({ id }) => id === 'generated-package-policy',
);
const handler = extension.projections.find(({ id }) => id === projectionDescriptor?.id);
if (handler === undefined || projectionDescriptor === undefined)
  throw new Error('Missing package policy.');
const original = {
  name: 'existing-consumer',
  packageManager: 'bun@0.0.1',
  dependencies: { '@ankhorage/contracts': '^0.0.1', 'user-owned': '^1.0.0' },
  devDependencies: { 'user-dev-owned': '^1.0.0' },
  scripts: { custom: 'preserve me' },
};
const documents = new Map([['package.json', `${JSON.stringify(original, null, 2)}\n`]]);
const project: ApmExtensionProjectReadPort = {
  readFileAsync: (filePath) => {
    const content = documents.get(filePath);
    return Promise.resolve({
      path: filePath,
      exists: content !== undefined,
      ...(content === undefined
        ? {}
        : {
            content,
            encoding: 'utf8' as const,
            digest: createHash('sha256').update(content).digest('hex'),
          }),
    });
  },
  listFilesAsync: () => Promise.resolve([]),
};
const input = {
  descriptor: projectionDescriptor,
  context: {
    owner: '@ankhorage/studio',
    sourceVersion: '2.5.7',
    targetVersion: packageJson.version,
    artifact,
  },
  project,
};
const before = documents.get('package.json');
assert.equal((await handler.inspectAsync(input)).state, 'stale');
const plan = await handler.planAsync(input);
assert.equal(documents.get('package.json'), before, 'Inspect/plan must not write the project.');
assert.ok(plan.mutations.length > 0);
const reviewed = new Map(plan.mutations.map((mutation) => [mutation.id, mutation]));
await handler.materializeAsync({
  ...input,
  plan,
  project: {
    ...project,
    applyReviewedMutationAsync: (id) => {
      const mutation = reviewed.get(id);
      if (mutation === undefined) throw new Error(`Unreviewed mutation: ${id}`);
      applyPackageMutation(mutation);
      return Promise.resolve();
    },
  },
});
assert.equal(
  (
    await handler.verifyAsync({
      ...input,
      plan,
      project: {
        ...project,
        applyReviewedMutationAsync: () => Promise.reject(new Error('Verification must not write.')),
      },
    })
  ).valid,
  true,
);
assert.equal((await handler.inspectAsync(input)).state, 'current');
assert.deepEqual((await handler.planAsync(input)).mutations, []);
const source = documents.get('package.json');
if (source === undefined) throw new Error('Consumer package disappeared.');
const result: unknown = JSON.parse(source);
assert.ok(isRecord(result));
assert.deepEqual(result.scripts, original.scripts);
assert.ok(isRecord(result.dependencies));
assert.equal(result.dependencies['user-owned'], original.dependencies['user-owned']);
assert.equal(result.dependencies['@ankhorage/studio'], undefined);
assert.equal(result.dependencies['@ankhorage/supabase-auth'], undefined);
assert.ok(isRecord(result.devDependencies));
assert.equal(result.devDependencies['user-dev-owned'], original.devDependencies['user-dev-owned']);
console.log(
  JSON.stringify({
    owner: descriptor.owner,
    integrity,
    descriptorDigest: artifact.descriptorDigest,
    reviewedMutations: plan.mutations.length,
    readOnlyPlanning: true,
    idempotent: true,
    verified: true,
    headlessNode: true,
  }),
);

/*** Apply only the reviewed Studio-owned package fields in this in-memory consumer fixture. */
function applyPackageMutation(mutation: ApmProjectMutation): void {
  if (mutation.kind !== 'set-json-pointer') throw new Error('Unexpected mutation kind.');
  assert.equal(mutation.path, 'package.json');
  const current: unknown = JSON.parse(documents.get('package.json') ?? '{}');
  if (!isRecord(current)) throw new Error('Invalid fixture package.');
  const [, section, encodedKey] = mutation.pointer.split('/');
  if (section === 'packageManager') {
    documents.set('package.json', JSON.stringify({ ...current, packageManager: mutation.value }));
    return;
  }
  if ((section !== 'dependencies' && section !== 'devDependencies') || encodedKey === undefined) {
    throw new Error('Mutation escaped Studio package-policy scope.');
  }
  const fields = readOwnProperty(current, section);
  if (!isRecord(fields)) throw new Error('Invalid dependency section.');
  const key = encodedKey.replaceAll('~1', '/').replaceAll('~0', '~');
  documents.set(
    'package.json',
    JSON.stringify({ ...current, [section]: { ...fields, [key]: mutation.value } }),
  );
}
