import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';

import { validateUpdateDescriptor } from '@ankhorage/apm';
import { planProjectAsync, statusProjectAsync } from '@ankhorage/apm/node';
import type {
  ApmExtensionProjectReadPort,
  ApmPlanProtocolPort,
  ApmProjectMutation,
  ApmStatusExtensionEvidencePort,
} from '@ankhorage/apm/types';
import extension from '@ankhorage/studio/apm';
import { isRecord, readOwnProperty } from '@ankhorage/utility/object';

const rootPath = process.cwd();
const entry = import.meta.resolve('@ankhorage/studio/apm');
const owner = await readRecordAsync(new URL('../package.json', entry));
const version = readOwnProperty(owner, 'version');
assert.equal(version, process.env.OWNER_VERSION);
if (typeof version !== 'string') throw new Error('Invalid owner version.');
const descriptorSource = await readFile(new URL('../apm/update.json', entry), 'utf8');
const descriptorJson: unknown = JSON.parse(descriptorSource);
const validation = validateUpdateDescriptor({
  descriptor: descriptorJson,
  expectedOwner: { name: '@ankhorage/studio', version },
});
assert.equal(validation.valid, true);
const descriptor = validation.descriptor?.projections.find(
  ({ id }) => id === 'generated-package-policy',
);
const handler = extension.projections.find(({ id }) => id === descriptor?.id);
if (descriptor === undefined || handler === undefined) throw new Error('Missing projection.');
const integrity: unknown = process.env.STUDIO_ARTIFACT_INTEGRITY;
if (typeof integrity !== 'string' || !integrity.startsWith('sha512-'))
  throw new Error('Missing verified integrity.');
const artifact = {
  role: 'target' as const,
  packageName: '@ankhorage/studio',
  version,
  integrity,
  descriptorDigest: digest(descriptorSource),
};
const project: ApmExtensionProjectReadPort = {
  readFileAsync: async (filePath) => {
    assert.equal(filePath, 'package.json');
    const content = await readFile(resolve(rootPath, filePath), 'utf8');
    return { path: filePath, exists: true, content, encoding: 'utf8', digest: digest(content) };
  },
  listFilesAsync: () => Promise.resolve([]),
};
const input = {
  descriptor,
  context: { owner: '@ankhorage/studio', sourceVersion: version, targetVersion: version, artifact },
  project,
};

if (process.argv[2] === 'prime') {
  const manifest = await readRecordAsync('package.json');
  await writeFile(
    'package.json',
    JSON.stringify({ ...manifest, packageManager: 'bun@1.4.2', devDependencies: {} }, null, 2) +
      '\n',
  );
  const plan = await handler.planAsync(input);
  const source = await readRecordAsync('package.json');
  const current = plan.mutations.reduce(setReviewedField, source);
  await writeFile('package.json', JSON.stringify(current, null, 2) + '\n');
} else {
  const baseline = await readRecordAsync('package.json');
  // Deliberate external drift, not a fabricated historical app or a dependency graph transition.
  await writeFile(
    'package.json',
    JSON.stringify({ ...baseline, packageManager: 'bun@1.4.1' }, null, 2) + '\n',
  );
  const beforeManifest = await readFile('package.json', 'utf8');
  const beforeLock = await readFile('bun.lock', 'utf8');
  const extensions: ApmStatusExtensionEvidencePort = {
    inspectExtensionEvidenceAsync: async () => {
      const inspection = await handler.inspectAsync(input);
      return {
        state: 'available',
        complete: inspection.state !== 'unknown',
        diagnostics: [],
        observations: [
          {
            owner: '@ankhorage/studio',
            projection: inspection.state,
            migration: 'current',
            evidence: inspection.evidence,
          },
        ],
      };
    },
  };
  const protocol: ApmPlanProtocolPort = {
    planProtocolAsync: async (request) => {
      const ownerPlan = await handler.planAsync(input);
      assert.equal(ownerPlan.mutations.length, 1);
      const [mutation] = ownerPlan.mutations;
      assert.ok(mutation?.kind === 'set-json-pointer');
      assert.equal(mutation.pointer, '/packageManager');
      const [installRoot] = request.status.installRoots;
      if (installRoot === undefined) throw new Error('Actual install-root evidence is missing.');
      return {
        complete: true,
        requiredSelections: [],
        files: [],
        effects: [],
        findings: [],
        blockers: [],
        diagnostics: [],
        artifacts: [
          {
            id: '@ankhorage/studio@' + version,
            packageName: '@ankhorage/studio',
            version,
            source: 'registry',
            integrity,
          },
        ],
        steps: [
          {
            id: 'studio:generated-package-policy',
            kind: 'projection',
            prerequisites: [],
            installRootId: installRoot.id,
            owner: '@ankhorage/studio',
            reason: 'Repair observed package-manager policy drift.',
            evidence: ownerPlan.evidence,
            execution: { kind: 'projection', descriptor, artifact, plan: ownerPlan },
          },
        ],
      };
    },
  };
  const result = await planProjectAsync(
    {
      rootPath,
      availability: 'refresh',
      policy: { dependencyUpdates: 'none', repairInstallations: false, repairProjections: true },
    },
    {
      status: { inspectStatusAsync: (request) => statusProjectAsync(request, { extensions }) },
      protocol,
    },
  );
  assert.equal(
    result.complete,
    true,
    JSON.stringify({ blockers: result.blockers, diagnostics: result.diagnostics }),
  );
  assert.deepEqual(result.blockers, []);
  assert.ok(result.steps.some(({ id }) => id === 'studio:generated-package-policy'));
  assert.equal(await readFile('package.json', 'utf8'), beforeManifest);
  assert.equal(await readFile('bun.lock', 'utf8'), beforeLock);
  console.log(
    JSON.stringify({
      owner: artifact.packageName,
      version,
      integrity,
      planId: result.id,
      complete: result.complete,
      readOnly: true,
      steps: result.steps,
    }),
  );
}

/*** Read one known owner/test package manifest without casting unknown JSON to a contract. */
async function readRecordAsync(path: string | URL): Promise<Readonly<Record<string, unknown>>> {
  const value: unknown = JSON.parse(await readFile(path, 'utf8'));
  if (!isRecord(value)) throw new Error('Expected package metadata object.');
  return value;
}

/*** Initialize only fields returned by the published owner while preparing the test fixture. */
function setReviewedField(
  manifest: Readonly<Record<string, unknown>>,
  mutation: ApmProjectMutation,
): Readonly<Record<string, unknown>> {
  if (mutation.kind !== 'set-json-pointer' || typeof mutation.value !== 'string')
    throw new Error('Unexpected owner mutation.');
  if (mutation.pointer === '/packageManager')
    return { ...manifest, packageManager: mutation.value };
  const [, section, encoded] = mutation.pointer.split('/');
  if ((section !== 'dependencies' && section !== 'devDependencies') || encoded === undefined)
    throw new Error('Unexpected owner scope.');
  const previous = readOwnProperty(manifest, section);
  if (!isRecord(previous)) throw new Error('Missing generated dependency section.');
  const key = encoded.replaceAll('~1', '/').replaceAll('~0', '~');
  return { ...manifest, [section]: { ...previous, [key]: mutation.value } };
}

/*** Fingerprint exact inspected bytes for the owner protocol. */
function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
