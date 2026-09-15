import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { AppManifest } from '@ankhorage/contracts';
import type {
  ApmApplyJournal,
  ApmExtensionArtifactIdentity,
  ApmPlanResult,
  ApmPlanStep,
  ApmStatusResult,
} from '@ankhorage/apm/types';
import { composeCategoryAppManifest } from '@ankhorage/templates';
import { expect, mock, test } from 'bun:test';

import {
  digestProjectUpdateText,
  readPendingModuleLifecycleStateAsync,
} from '../adapters/outbound/readPendingModuleLifecycleStateAsync';
import { readCurrentStudioApmArtifactBindingAsync } from '../adapters/outbound/resolveCurrentStudioApmArtifactAsync';
import type { StudioPendingModuleLifecyclePort } from '../application/StudioPendingModuleLifecyclePort';
import { planPendingModuleLifecycleAsync } from '../application/planPendingModuleLifecycleAsync';
import { STUDIO_PENDING_MODULE_LIFECYCLE_FILE } from '../constants';
import { createStudioProjectUpdateApplyOwnerStepPort } from './createStudioProjectUpdateApplyOwnerStepPort';
import { createStudioProjectUpdateVerifyOwnerStepPort } from './createStudioProjectUpdateVerifyOwnerStepPort';

const FIXED_NOW = '2026-09-15T04:00:00.000Z';

test('plans one reviewed owner removal followed by native APM file finalization without writing', async () => {
  const fixture = await createPlanFixtureAsync();
  try {
    expect(fixture.slice.blockers).toEqual([]);
    expect(fixture.slice.steps.map(({ kind }) => kind)).toEqual(['projection', 'dependency-files']);
    expect(fixture.slice.files.map(({ path: filePath }) => filePath)).toEqual([
      'ankh.config.json',
      STUDIO_PENDING_MODULE_LIFECYCLE_FILE,
    ]);
    expect(fixture.slice.files[1]?.kind).toBe('delete');
    expect(await readFile(path.join(fixture.rootPath, 'ankh.config.json'), 'utf8')).toBe(
      fixture.manifestContent,
    );
    expect(
      await readFile(path.join(fixture.rootPath, STUDIO_PENDING_MODULE_LIFECYCLE_FILE), 'utf8'),
    ).toBe(fixture.pendingContent);

    const manifestChange = fixture.slice.files.find(({ path: filePath }) =>
      filePath === 'ankh.config.json',
    );
    if (manifestChange?.afterContent === undefined) throw new Error('Missing reviewed manifest.');
    const reviewedManifest: unknown = JSON.parse(manifestChange.afterContent);
    expect(readInfraModules(reviewedManifest)).toEqual([]);
  } finally {
    await removeFixtureAsync(fixture.rootPath);
  }
});

test('executes one installed reviewed module removal and verifies its postcondition', async () => {
  const fixture = await createPlanFixtureAsync();
  const states: Array<boolean | undefined> = [true, false];
  const removeModuleAsync = mock(() => Promise.resolve());
  const lifecycle: StudioPendingModuleLifecyclePort = {
    isModuleInstalledAsync: () => Promise.resolve(states.shift()),
    removeModuleAsync,
  };

  try {
    const journal = createJournal(fixture.rootPath, fixture.step);
    const result = await createStudioProjectUpdateApplyOwnerStepPort(lifecycle).executeAsync({
      journal,
      step: fixture.step,
    });

    expect(result.state).toBe('completed');
    expect(removeModuleAsync).toHaveBeenCalledTimes(1);
    expect(removeModuleAsync).toHaveBeenCalledWith(fixture.rootPath, 'module-a');
  } finally {
    await removeFixtureAsync(fixture.rootPath);
  }
});

test('resume observes an already removed reviewed module as satisfied without replaying removal', async () => {
  const fixture = await createPlanFixtureAsync();
  const removeModuleAsync = mock(() => Promise.resolve());
  const lifecycle: StudioPendingModuleLifecyclePort = {
    isModuleInstalledAsync: () => Promise.resolve(false),
    removeModuleAsync,
  };

  try {
    const journal = createJournal(fixture.rootPath, fixture.step);
    const observation = await createStudioProjectUpdateApplyOwnerStepPort(lifecycle).observeAsync({
      journal,
      step: fixture.step,
    });
    const execution = await createStudioProjectUpdateApplyOwnerStepPort(lifecycle).executeAsync({
      journal,
      step: fixture.step,
    });

    expect(observation.state).toBe('satisfied');
    expect(execution.state).toBe('completed');
    expect(removeModuleAsync).toHaveBeenCalledTimes(0);
  } finally {
    await removeFixtureAsync(fixture.rootPath);
  }
});

test('pending-state drift conflicts before consulting or executing Orchestrator', async () => {
  const fixture = await createPlanFixtureAsync();
  const isModuleInstalledAsync = mock(() => Promise.resolve(true));
  const removeModuleAsync = mock(() => Promise.resolve());
  const lifecycle: StudioPendingModuleLifecyclePort = {
    isModuleInstalledAsync,
    removeModuleAsync,
  };

  try {
    await writeFile(
      path.join(fixture.rootPath, STUDIO_PENDING_MODULE_LIFECYCLE_FILE),
      pendingContent('module-a', '2026-09-15T04:01:00.000Z'),
      'utf8',
    );
    const observation = await createStudioProjectUpdateApplyOwnerStepPort(lifecycle).observeAsync({
      journal: createJournal(fixture.rootPath, fixture.step),
      step: fixture.step,
    });

    expect(observation.state).toBe('conflict');
    expect(isModuleInstalledAsync).toHaveBeenCalledTimes(0);
    expect(removeModuleAsync).toHaveBeenCalledTimes(0);
  } finally {
    await removeFixtureAsync(fixture.rootPath);
  }
});

test('manifest drift conflicts before consulting or executing Orchestrator', async () => {
  const fixture = await createPlanFixtureAsync();
  const isModuleInstalledAsync = mock(() => Promise.resolve(true));
  const removeModuleAsync = mock(() => Promise.resolve());
  const lifecycle: StudioPendingModuleLifecyclePort = {
    isModuleInstalledAsync,
    removeModuleAsync,
  };

  try {
    await writeFile(
      path.join(fixture.rootPath, 'ankh.config.json'),
      `${fixture.manifestContent}\n`,
      'utf8',
    );
    const observation = await createStudioProjectUpdateApplyOwnerStepPort(lifecycle).observeAsync({
      journal: createJournal(fixture.rootPath, fixture.step),
      step: fixture.step,
    });

    expect(observation.state).toBe('conflict');
    expect(isModuleInstalledAsync).toHaveBeenCalledTimes(0);
    expect(removeModuleAsync).toHaveBeenCalledTimes(0);
  } finally {
    await removeFixtureAsync(fixture.rootPath);
  }
});

test('owner verification passes only after the reviewed module is absent', async () => {
  const fixture = await createPlanFixtureAsync();
  try {
    const journal = createJournal(fixture.rootPath, fixture.step);
    const input = {
      journal,
      plan: journal.plan,
      step: fixture.step,
      status: createStatus(fixture.rootPath),
    };
    const passed = await createStudioProjectUpdateVerifyOwnerStepPort({
      isModuleInstalledAsync: () => Promise.resolve(false),
      removeModuleAsync: () => Promise.resolve(),
    }).verifyAsync(input);
    const failed = await createStudioProjectUpdateVerifyOwnerStepPort({
      isModuleInstalledAsync: () => Promise.resolve(true),
      removeModuleAsync: () => Promise.resolve(),
    }).verifyAsync(input);

    expect(passed[0]?.status).toBe('passed');
    expect(failed[0]?.status).toBe('failed');
  } finally {
    await removeFixtureAsync(fixture.rootPath);
  }
});

interface PlanFixture {
  readonly rootPath: string;
  readonly manifestContent: string;
  readonly pendingContent: string;
  readonly step: ApmPlanStep;
  readonly slice: Awaited<ReturnType<typeof planPendingModuleLifecycleAsync>>;
}

/*** Materialize one valid project with a single reviewed pending module removal. */
async function createPlanFixtureAsync(): Promise<PlanFixture> {
  const rootPath = await mkdtemp(path.join(tmpdir(), 'studio-reviewed-pending-module-'));
  const manifest = createFixtureManifest();
  const manifestContent = `${JSON.stringify(manifest, null, 2)}\n`;
  const pending = pendingContent('module-a', '2026-09-15T03:00:00.000Z');
  await mkdir(path.join(rootPath, '.ankh'), { recursive: true });
  await writeFile(path.join(rootPath, 'ankh.config.json'), manifestContent, 'utf8');
  await writeFile(path.join(rootPath, STUDIO_PENDING_MODULE_LIFECYCLE_FILE), pending, 'utf8');

  const pendingState = await readPendingModuleLifecycleStateAsync(rootPath);
  if (pendingState.state !== 'valid') throw new Error('Pending fixture must be valid.');
  const binding = await readCurrentStudioApmArtifactBindingAsync();
  const artifact: ApmExtensionArtifactIdentity = {
    role: 'target',
    ...binding,
    integrity: 'sha512-fixture',
  };
  const slice = await planPendingModuleLifecycleAsync({
    rootPath,
    expectedPendingDigest: pendingState.digest,
    resolveArtifactAsync: () =>
      Promise.resolve({ state: 'resolved', artifact, evidence: ['fixture-artifact'] }),
    nowIso: () => FIXED_NOW,
  });
  const step = slice.steps.find(({ execution }) => execution.kind === 'projection');
  if (step === undefined) throw new Error('Missing reviewed module-removal step.');
  return { rootPath, manifestContent, pendingContent: pending, step, slice };
}

/*** Build a canonical manifest whose Infra lifecycle currently contains the fixture module. */
function createFixtureManifest(): AppManifest {
  const base = composeCategoryAppManifest({
    category: 'food_drink',
    name: 'APM pending module fixture',
    slug: 'apm-pending-module-fixture',
    navigator: {
      type: 'stack',
      initialRouteName: 'home',
      routes: [{ name: 'home', label: 'Home', path: '', screenId: 'home' }],
    },
    screens: {
      home: {
        id: 'home',
        name: 'Home',
        root: { id: 'home-root', type: 'Screen', props: {}, children: [] },
      },
    },
  }).manifest;
  return {
    ...base,
    infra: {
      ...base.infra,
      modules: ['module-a'],
      modulesConfig: { 'module-a': { enabled: true } },
    },
  };
}

/*** Serialize one current Studio pending uninstall operation. */
function pendingContent(moduleId: string, at: string): string {
  return `${JSON.stringify({ ops: [{ type: 'uninstall', moduleId, at }] }, null, 2)}\n`;
}

/*** Build the minimum durable APM journal required by the Studio owner-step adapter. */
function createJournal(rootPath: string, step: ApmPlanStep): ApmApplyJournal {
  const updatedAt = '2026-09-15T04:02:00.000Z';
  return {
    schemaVersion: 1,
    operationId: 'fixture-operation',
    rootPath,
    plan: createPlan(rootPath, step),
    permissions: { ownerCode: true, lifecycleScripts: false, externalEffects: false },
    status: 'running',
    createdAt: updatedAt,
    updatedAt,
    steps: [
      {
        stepId: step.id,
        state: 'pending',
        attempts: 0,
        updatedAt,
        evidence: [],
      },
    ],
  };
}

/*** Build one complete reviewed plan around a single owner step for adapter tests. */
function createPlan(rootPath: string, step: ApmPlanStep): ApmPlanResult {
  return {
    schemaVersion: 2,
    operation: 'plan',
    id: 'fixture-plan',
    rootPath,
    complete: true,
    policy: {
      dependencyUpdates: 'none',
      selections: [],
      repairInstallations: false,
      repairProjections: true,
      maxGeneratorIterations: 8,
    },
    executor: { apmVersion: '0.8.1', runtime: 'node', runtimeVersion: process.version },
    inputFingerprint: {
      value: 'fixture-input',
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
}

/*** Build complete fresh status evidence for owner verification. */
function createStatus(rootPath: string): ApmStatusResult {
  return {
    schemaVersion: 2,
    operation: 'status',
    rootPath,
    complete: true,
    currency: 'current',
    project: {
      traits: [],
      languages: [],
      packageManagers: [],
      buildTools: [],
      packageCount: 0,
      workspaceCount: 0,
    },
    installRoots: [],
    dependencies: [],
    hosts: [],
    extensions: { state: 'available', complete: true, observations: [], diagnostics: [] },
    findings: [],
    diagnostics: [],
  };
}

/*** Read Infra module ids from an unknown manifest only for a test assertion. */
function readInfraModules(value: unknown): readonly unknown[] | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const infra = Object.entries(value).find(([key]) => key === 'infra')?.[1];
  if (typeof infra !== 'object' || infra === null || Array.isArray(infra)) return undefined;
  const modules = Object.entries(infra).find(([key]) => key === 'modules')?.[1];
  return Array.isArray(modules) ? modules : undefined;
}

/*** Remove one temporary project root after each owner-step test. */
function removeFixtureAsync(rootPath: string): Promise<void> {
  return rm(rootPath, { recursive: true, force: true });
}
