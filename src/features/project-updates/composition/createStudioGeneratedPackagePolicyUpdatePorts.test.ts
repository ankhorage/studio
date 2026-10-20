import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type {
  ApmApplyJournal,
  ApmDependencyInventory,
  ApmPlanResult,
  ApmPlanStep,
  ApmStatusDependency,
  ApmStatusResult,
} from '@ankhorage/apm/types';
import { isRecord } from '@ankhorage/utility/object';
import { expect, test } from 'bun:test';

import { studioUpdateExtension } from '../adapters/inbound/studioUpdateExtension';
import { getGeneratedPackagePolicy } from '../adapters/outbound/getGeneratedPackagePolicy';
import { applyGeneratedPackagePolicy } from '../domain/applyGeneratedPackagePolicy';
import { createStudioGeneratedPackagePolicyUpdatePorts } from './createStudioGeneratedPackagePolicyUpdatePorts';

test('reconciles an existing generated app to the current Studio owner policy without regeneration', async () => {
  const rootPath = await mkdtemp(path.join(tmpdir(), 'studio-generated-update-'));
  const policy = getGeneratedPackagePolicy();
  const current = applyGeneratedPackagePolicy(
    {
      packageManager: policy.packageManager,
      dependencies: {
        '@ankhorage/studio': '^5.10.0',
        '@ankhorage/utility': '^1.0.0',
        '@ankhorage/supabase-auth': '^1.0.0',
        '@ankhorage/storage-supabase': '^1.0.0',
        'user-owned-package': '^9.0.0',
      },
      devDependencies: { 'user-owned-dev-package': '^4.0.0' },
    },
    policy,
  );
  const stale = {
    ...current,
    dependencies: { ...current.dependencies, '@ankhorage/studio': '^5.10.0' },
  };
  await writeFile(path.join(rootPath, 'package.json'), `${JSON.stringify(stale, null, 2)}\n`);

  try {
    const ports = createStudioGeneratedPackagePolicyUpdatePorts(
      {},
      { resolveArtifactAsync: () => Promise.resolve(artifactResolution(policy.ownerVersion)) },
    );
    const { applyOwnerStep, extensions, protocol, verifyOwnerStep } = ports;
    if (
      extensions === undefined ||
      protocol === undefined ||
      applyOwnerStep === undefined ||
      verifyOwnerStep === undefined
    ) {
      throw new Error('Generated package-policy lifecycle ports must be composed.');
    }

    const inventory = inventoryFixture(rootPath);
    const evidence = await extensions.inspectExtensionEvidenceAsync({ rootPath, inventory });
    expect(evidence.complete).toBe(true);
    expect(
      evidence.observations.some(
        ({ migration, owner, projection }) =>
          owner === '@ankhorage/studio' && projection === 'stale' && migration === 'not-applicable',
      ),
    ).toBe(true);

    const dependency = studioDependency();
    const status = statusFixture(rootPath, inventory, dependency, evidence);
    const planned = await protocol.planProtocolAsync({
      status,
      policy: {
        dependencyUpdates: 'safe',
        selections: [],
        repairInstallations: true,
        repairProjections: true,
        maxGeneratorIterations: 4,
      },
      inputFingerprint: {
        value: 'generated-app-fixture',
        statusSchemaVersion: 2,
        availabilityCheckedAt: [],
      },
      targets: [],
      resolutions: [],
    });

    expect(planned.complete).toBe(true);
    expect(planned.blockers).toEqual([]);
    expect(planned.requiredSelections).toContainEqual({
      selector: {
        name: '@ankhorage/studio',
        packageId: dependency.packageId,
        installRootId: dependency.installRootId,
        ownerPath: 'package.json',
      },
      target: {
        kind: 'version',
        version: policy.ownerVersion,
        manifestRange: policy.dependencies.studio,
      },
    });
    const step = planned.steps.find(
      ({ execution }) =>
        execution.kind === 'projection' && execution.descriptor.id === 'generated-package-policy',
    );
    if (step === undefined) throw new Error('Generated package-policy projection step is missing.');

    const journal = journalFixture(rootPath, step);
    expect((await applyOwnerStep.observeAsync({ journal, step })).state).toBe('pending');
    expect((await applyOwnerStep.executeAsync({ journal, step })).state).toBe('completed');
    expect((await applyOwnerStep.observeAsync({ journal, step })).state).toBe('satisfied');

    const after: unknown = JSON.parse(await readFile(path.join(rootPath, 'package.json'), 'utf8'));
    if (!isRecord(after) || !isRecord(after.dependencies)) {
      throw new Error('Updated generated package.json must retain dependency records.');
    }
    expect(after.dependencies['@ankhorage/studio']).toBe(policy.dependencies.studio);
    expect(after.dependencies['user-owned-package']).toBe('^9.0.0');

    const checks = await verifyOwnerStep.verifyAsync({
      journal,
      plan: journal.plan,
      step,
      status,
    });
    expect(
      checks.some(
        ({ id, kind, status: checkStatus }) =>
          id === `verify:${step.id}` && kind === 'projection' && checkStatus === 'passed',
      ),
    ).toBe(true);
    expect((await applyOwnerStep.rollbackAsync({ journal, step })).state).toBe('completed');
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
});

/*** Build immutable current-owner artifact identity without a live registry request. */
function artifactResolution(version: string) {
  return {
    state: 'resolved' as const,
    artifact: {
      role: 'target' as const,
      packageName: '@ankhorage/studio',
      version,
      integrity: 'sha512-studio-generated-update-fixture',
      descriptorDigest: studioUpdateExtension.descriptorDigest,
    },
    evidence: ['fixture-artifact'],
  };
}

/*** Build one root inventory with an old direct Studio dependency. */
function inventoryFixture(rootPath: string): ApmDependencyInventory {
  return {
    roots: [
      {
        id: '.',
        rootPath,
        packagePaths: [rootPath],
        manager: {
          state: 'selected',
          name: 'bun',
          version: '1.4.2',
          source: 'package-manager-field',
        },
        linker: 'isolated',
        lockfile: {
          state: 'supported',
          path: 'bun.lock',
          format: 'bun-text-lock',
          version: '1',
          evidence: ['bun.lock'],
        },
        declarations: [
          {
            ownerPath: 'package.json',
            name: '@ankhorage/studio',
            range: '^5.10.0',
            kind: 'dependency',
            resolvedPackageId: 'bun:@ankhorage/studio',
          },
        ],
        lockedPackages: [
          {
            id: 'bun:@ankhorage/studio',
            name: '@ankhorage/studio',
            version: '5.10.13',
            source: 'registry',
            optional: false,
            dependencies: [],
          },
        ],
        installedPackages: [
          {
            packageId: 'bun:@ankhorage/studio',
            state: 'present',
            source: 'bun-store',
            version: '5.10.13',
          },
        ],
        complete: true,
        diagnostics: [],
      },
    ],
    complete: true,
    diagnostics: [],
  };
}

/*** Build evaluated direct Studio status matching the old generated app. */
function studioDependency(): ApmStatusDependency {
  return {
    packageId: '.::bun:@ankhorage/studio',
    installRootId: '.',
    name: '@ankhorage/studio',
    direct: true,
    declaration: {
      ownerPath: 'package.json',
      name: '@ankhorage/studio',
      range: '^5.10.0',
      kind: 'dependency',
      resolvedPackageId: 'bun:@ankhorage/studio',
    },
    lockedVersion: '5.10.13',
    installed: {
      packageId: 'bun:@ankhorage/studio',
      state: 'present',
      source: 'bun-store',
      version: '5.10.13',
    },
    availability: {
      packageId: '.::bun:@ankhorage/studio',
      name: '@ankhorage/studio',
      state: 'known',
      latestVersion: getGeneratedPackagePolicy().ownerVersion,
      compatibleVersion: '5.10.13',
    },
    dependencyPaths: [['.::bun:@ankhorage/studio']],
    findings: [],
  };
}

/*** Build complete status carrying the package-policy extension observation. */
function statusFixture(
  rootPath: string,
  inventory: ApmDependencyInventory,
  dependency: ApmStatusDependency,
  extensions: ApmStatusResult['extensions'],
): ApmStatusResult {
  return {
    schemaVersion: 2,
    operation: 'status',
    rootPath,
    complete: true,
    currency: 'outdated',
    project: {
      traits: [],
      languages: [],
      packageManagers: ['bun'],
      buildTools: [],
      packageCount: 1,
      workspaceCount: 0,
    },
    installRoots: inventory.roots,
    dependencies: [dependency],
    hosts: [],
    extensions,
    findings: [],
    diagnostics: [],
  };
}

/*** Build the minimal durable journal required by the trusted owner step adapter. */
function journalFixture(rootPath: string, step: ApmPlanStep): ApmApplyJournal {
  const plan: ApmPlanResult = {
    schemaVersion: 2,
    operation: 'plan',
    id: 'generated-package-policy-plan',
    rootPath,
    complete: true,
    policy: {
      dependencyUpdates: 'safe',
      selections: [],
      repairInstallations: true,
      repairProjections: true,
      maxGeneratorIterations: 4,
    },
    executor: { apmVersion: 'fixture', runtime: 'node', runtimeVersion: '24.0.0' },
    inputFingerprint: {
      value: 'generated-app-fixture',
      statusSchemaVersion: 2,
      availabilityCheckedAt: [],
    },
    targets: [],
    files: [],
    packages: [],
    artifacts: [],
    steps: [step],
    effects: [],
    findings: [],
    blockers: [],
    diagnostics: [],
  };
  return {
    schemaVersion: 1,
    operationId: 'generated-app-update',
    rootPath,
    plan,
    permissions: { ownerCode: true, lifecycleScripts: false, externalEffects: false },
    status: 'running',
    createdAt: '2026-10-03T00:00:00.000Z',
    updatedAt: '2026-10-03T00:00:00.000Z',
    steps: [
      {
        stepId: step.id,
        state: 'pending',
        attempts: 0,
        updatedAt: '2026-10-03T00:00:00.000Z',
        evidence: [],
      },
    ],
  };
}
