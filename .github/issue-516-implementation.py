from pathlib import Path


def write(path: str, content: str) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')


def replace(path: str, old: str, new: str) -> None:
    target = Path(path)
    source = target.read_text(encoding='utf-8')
    if old not in source:
        raise RuntimeError(f"Expected source fragment not found in {path}: {old[:120]!r}")
    target.write_text(source.replace(old, new, 1), encoding='utf-8')


write(
    'src/types/project-generation.ts',
    """export type StudioRuntimeProjectionStatus = 'current' | 'pending' | 'failed' | 'unknown';

export type StudioRuntimeProjectionReason =
  | 'applied'
  | 'manifest-changed'
  | 'projection-failed'
  | 'missing-evidence';

export interface StudioRuntimeProjectionState {
  readonly status: StudioRuntimeProjectionStatus;
  readonly reason: StudioRuntimeProjectionReason;
}

export interface ProjectRuntimeProjectionEvidence {
  readonly appliedSignature?: string;
  readonly failedSignature?: string;
}
""",
)

write(
    'src/features/projects/domain/resolveStudioRuntimeProjectionState.ts',
    """import type {
  ProjectRuntimeProjectionEvidence,
  StudioRuntimeProjectionState,
} from '../../../types/project-generation';

/*** Resolve durable runtime projection evidence against the current runtime-relevant manifest signature. */
export function resolveStudioRuntimeProjectionState(
  evidence: ProjectRuntimeProjectionEvidence | undefined,
  expectedSignature: string,
): StudioRuntimeProjectionState {
  if (!evidence) {
    return { status: 'unknown', reason: 'missing-evidence' };
  }
  if (evidence.failedSignature === expectedSignature) {
    return { status: 'failed', reason: 'projection-failed' };
  }
  if (evidence.appliedSignature === expectedSignature) {
    return { status: 'current', reason: 'applied' };
  }
  if (evidence.appliedSignature !== undefined || evidence.failedSignature !== undefined) {
    return { status: 'pending', reason: 'manifest-changed' };
  }
  return { status: 'unknown', reason: 'missing-evidence' };
}
""",
)

write(
    'src/features/projects/adapters/outbound/ProjectGenerationStateStore.ts',
    """import { isMissingPathError, writeJsonFileAtomic } from '@ankhorage/utility/node/fs';
import { isRecord } from '@ankhorage/utility/object';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import type {
  ProjectRuntimeProjectionEvidence,
  StudioRuntimeProjectionState,
} from '../../../../types/project-generation';
import { resolveStudioRuntimeProjectionState } from '../../domain/resolveStudioRuntimeProjectionState';

const PROJECT_GENERATION_STATE_REL_PATH = '.ankh/generation-state.json';

interface ProjectGenerationState {
  readonly includeStudio: boolean;
  readonly runtimeProjection?: ProjectRuntimeProjectionEvidence;
}

/*** Persist and inspect Studio-owned generated-project state in the canonical `.ankh/generation-state.json` document. */
export class ProjectGenerationStateStore {
  /*** Read whether the current generated project state includes the Studio admin surface. */
  async readStudioInclusionAsync(projectPath: string): Promise<boolean> {
    const state = await this.requireStateAsync(projectPath);
    return state.includeStudio;
  }

  /*** Atomically persist Studio inclusion while preserving runtime projection evidence owned by the same state document. */
  async writeStudioInclusionAsync(projectPath: string, includeStudio: boolean): Promise<void> {
    const statePath = this.resolveStatePath(projectPath);
    const current = await this.readStateAsync(statePath, true);
    const state: ProjectGenerationState = current
      ? { ...current, includeStudio }
      : { includeStudio };
    await writeJsonFileAtomic(statePath, state);
  }

  /*** Resolve current runtime projection currency without exposing persisted runtime signatures to callers. */
  async readRuntimeProjectionStateAsync(
    projectPath: string,
    expectedSignature: string,
  ): Promise<StudioRuntimeProjectionState> {
    const state = await this.requireStateAsync(projectPath);
    return resolveStudioRuntimeProjectionState(state.runtimeProjection, expectedSignature);
  }

  /*** Record the exact runtime signature only after the owning projection operation completed successfully. */
  async recordRuntimeProjectionSuccessAsync(
    projectPath: string,
    appliedSignature: string,
  ): Promise<void> {
    const statePath = this.resolveStatePath(projectPath);
    const current = await this.requireStateAsync(projectPath);
    await writeJsonFileAtomic(statePath, {
      ...current,
      runtimeProjection: { appliedSignature },
    });
  }

  /*** Persist bounded failure evidence for one attempted runtime signature while retaining the last successful signature. */
  async recordRuntimeProjectionFailureAsync(
    projectPath: string,
    failedSignature: string,
  ): Promise<void> {
    const statePath = this.resolveStatePath(projectPath);
    const current = await this.requireStateAsync(projectPath);
    const appliedSignature = current.runtimeProjection?.appliedSignature;
    await writeJsonFileAtomic(statePath, {
      ...current,
      runtimeProjection: {
        ...(appliedSignature === undefined ? {} : { appliedSignature }),
        failedSignature,
      },
    });
  }

  /*** Read one required generation-state document and reject missing state instead of inferring ownership. */
  private async requireStateAsync(projectPath: string): Promise<ProjectGenerationState> {
    const state = await this.readStateAsync(this.resolveStatePath(projectPath), false);
    if (!state) throw new Error('Project generation state unexpectedly resolved as missing.');
    return state;
  }

  /*** Read, parse and validate one generation-state document, optionally treating a missing file as an empty owner state. */
  private async readStateAsync(
    statePath: string,
    allowMissing: boolean,
  ): Promise<ProjectGenerationState | null> {
    const source = await this.readStateSourceAsync(statePath, allowMissing);
    if (source === null) return null;
    const parsed = this.parseStateSource(source, statePath);
    if (!this.isProjectGenerationState(parsed)) {
      throw new Error(`Project generation state is invalid at '${statePath}'.`);
    }
    return parsed;
  }

  /*** Read one generation-state source document with explicit missing-state semantics. */
  private async readStateSourceAsync(statePath: string, allowMissing: boolean): Promise<string | null> {
    try {
      return await fs.readFile(statePath, 'utf8');
    } catch (error) {
      if (allowMissing && isMissingPathError(error)) return null;
      if (isMissingPathError(error)) {
        throw new Error(
          `Project generation state is missing at '${statePath}'. Run an explicit project sync with includeStudio set before using implicit runtime sync.`,
          { cause: error },
        );
      }
      throw error;
    }
  }

  /*** Parse one generation-state JSON source while preserving the original parse error as its cause. */
  private parseStateSource(source: string, statePath: string): unknown {
    try {
      return JSON.parse(source) as unknown;
    } catch (error) {
      throw new Error(`Project generation state is invalid at '${statePath}'.`, { cause: error });
    }
  }

  /*** Validate the semantic shape of Studio's generated-project state document. */
  private isProjectGenerationState(value: unknown): value is ProjectGenerationState {
    return (
      isRecord(value) &&
      typeof value.includeStudio === 'boolean' &&
      (value.runtimeProjection === undefined ||
        this.isRuntimeProjectionEvidence(value.runtimeProjection))
    );
  }

  /*** Validate persisted runtime projection evidence without accepting unrelated or malformed values. */
  private isRuntimeProjectionEvidence(value: unknown): value is ProjectRuntimeProjectionEvidence {
    return (
      isRecord(value) &&
      (value.appliedSignature === undefined || typeof value.appliedSignature === 'string') &&
      (value.failedSignature === undefined || typeof value.failedSignature === 'string') &&
      (typeof value.appliedSignature === 'string' || typeof value.failedSignature === 'string')
    );
  }

  /*** Resolve the canonical project generation-state path while rejecting path escape. */
  private resolveStatePath(projectPath: string): string {
    const root = path.resolve(projectPath);
    const target = path.resolve(root, PROJECT_GENERATION_STATE_REL_PATH);
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Invalid project generation state path: ${PROJECT_GENERATION_STATE_REL_PATH}`);
    }
    return target;
  }
}
""",
)

write(
    'src/features/projects/composition/createProjectGenerationStateStore.ts',
    """import { ProjectGenerationStateStore } from '../adapters/outbound/ProjectGenerationStateStore';

/*** Compose Studio's canonical generated-project state store for host project lifecycle orchestration. */
export function createProjectGenerationStateStore(): ProjectGenerationStateStore {
  return new ProjectGenerationStateStore();
}
""",
)

write(
    'src/features/projects/adapters/outbound/ProjectGenerationStateStore.test.ts',
    """import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, test } from 'bun:test';

import { ProjectGenerationStateStore } from './ProjectGenerationStateStore';

const store = new ProjectGenerationStateStore();

/*** Capture one asynchronous test failure as an Error value. */
async function captureErrorAsync(operation: () => Promise<unknown>): Promise<Error | null> {
  try {
    await operation();
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

test('persists explicit Studio inclusion without inventing runtime projection evidence', async () => {
  const projectPath = await mkdtemp(path.join(tmpdir(), 'ankhorage-studio-generation-state-'));

  await store.writeStudioInclusionAsync(projectPath, true);

  expect(await store.readStudioInclusionAsync(projectPath)).toBe(true);
  expect(
    JSON.parse(await readFile(path.join(projectPath, '.ankh/generation-state.json'), 'utf8')),
  ).toEqual({ includeStudio: true });
  expect(await store.readRuntimeProjectionStateAsync(projectPath, 'runtime-a')).toEqual({
    status: 'unknown',
    reason: 'missing-evidence',
  });
});

test('preserves runtime projection evidence when Studio inclusion changes', async () => {
  const projectPath = await mkdtemp(path.join(tmpdir(), 'ankhorage-studio-generation-state-'));
  await store.writeStudioInclusionAsync(projectPath, true);
  await store.recordRuntimeProjectionSuccessAsync(projectPath, 'runtime-a');

  await store.writeStudioInclusionAsync(projectPath, false);

  expect(await store.readStudioInclusionAsync(projectPath)).toBe(false);
  expect(await store.readRuntimeProjectionStateAsync(projectPath, 'runtime-a')).toEqual({
    status: 'current',
    reason: 'applied',
  });
});

test('reports persisted runtime drift as pending without a second pending ledger write', async () => {
  const projectPath = await mkdtemp(path.join(tmpdir(), 'ankhorage-studio-generation-state-'));
  await store.writeStudioInclusionAsync(projectPath, true);
  await store.recordRuntimeProjectionSuccessAsync(projectPath, 'runtime-a');

  expect(await store.readRuntimeProjectionStateAsync(projectPath, 'runtime-b')).toEqual({
    status: 'pending',
    reason: 'manifest-changed',
  });
});

test('keeps failed projection evidence visible until that runtime signature succeeds', async () => {
  const projectPath = await mkdtemp(path.join(tmpdir(), 'ankhorage-studio-generation-state-'));
  await store.writeStudioInclusionAsync(projectPath, true);
  await store.recordRuntimeProjectionSuccessAsync(projectPath, 'runtime-a');
  await store.recordRuntimeProjectionFailureAsync(projectPath, 'runtime-b');

  expect(await store.readRuntimeProjectionStateAsync(projectPath, 'runtime-b')).toEqual({
    status: 'failed',
    reason: 'projection-failed',
  });
  expect(await store.readRuntimeProjectionStateAsync(projectPath, 'runtime-c')).toEqual({
    status: 'pending',
    reason: 'manifest-changed',
  });

  await store.recordRuntimeProjectionSuccessAsync(projectPath, 'runtime-b');

  expect(await store.readRuntimeProjectionStateAsync(projectPath, 'runtime-b')).toEqual({
    status: 'current',
    reason: 'applied',
  });
});

test('requires explicit generation state instead of inferring Studio inclusion', async () => {
  const projectPath = await mkdtemp(path.join(tmpdir(), 'ankhorage-studio-generation-state-'));

  const error = await captureErrorAsync(() => store.readStudioInclusionAsync(projectPath));

  expect(error).not.toBeNull();
  expect(error?.message).toContain('Project generation state is missing');
});

test('rejects invalid runtime projection evidence', async () => {
  const projectPath = await mkdtemp(path.join(tmpdir(), 'ankhorage-studio-generation-state-'));
  const statePath = path.join(projectPath, '.ankh/generation-state.json');
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(
    statePath,
    JSON.stringify({ includeStudio: true, runtimeProjection: { appliedSignature: 1 } }),
    'utf8',
  );

  const error = await captureErrorAsync(() => store.readStudioInclusionAsync(projectPath));

  expect(error).not.toBeNull();
  expect(error?.message).toContain('Project generation state is invalid');
});
""",
)

Path('src/host/orchestrator/projectGenerationState.ts').unlink()
Path('src/host/orchestrator/projectGenerationState.test.ts').unlink()

replace(
    'src/host/orchestrator/projectManager.ts',
    "import { createStudioProjectWriterProxy } from '../../features/project-updates/composition/createStudioProjectWriterProxy';\n",
    "import { createStudioProjectWriterProxy } from '../../features/project-updates/composition/createStudioProjectWriterProxy';\nimport { createProjectGenerationStateStore } from '../../features/projects/composition/createProjectGenerationStateStore';\n",
)
replace(
    'src/host/orchestrator/projectManager.ts',
    "} from '../../projectIdentity';\n",
    "} from '../../projectIdentity';\nimport { createStudioRuntimeSyncSignature } from '../../manifestSync';\n",
)
replace(
    'src/host/orchestrator/projectManager.ts',
    "import { readProjectStudioInclusion, writeProjectStudioInclusion } from './projectGenerationState';\n",
    '',
)
replace(
    'src/host/orchestrator/projectManager.ts',
    "  private readonly dependencies: ProjectManagerDependencies;\n  private readonly appsRoot: string;\n",
    "  private readonly dependencies: ProjectManagerDependencies;\n  private readonly generationState = createProjectGenerationStateStore();\n  private readonly appsRoot: string;\n",
)
replace(
    'src/host/orchestrator/projectManager.ts',
    '    await writeProjectStudioInclusion(projectPath, includeStudio);\n',
    '    await this.generationState.writeStudioInclusionAsync(projectPath, includeStudio);\n',
)
replace(
    'src/host/orchestrator/projectManager.ts',
    "    await this.dependencies.reconcileProjectPackageRootAsync(projectPath);\n    if (onProjectCreated) await onProjectCreated(slug);\n",
    "    await this.dependencies.reconcileProjectPackageRootAsync(projectPath);\n    await this.generationState.recordRuntimeProjectionSuccessAsync(\n      projectPath,\n      createStudioRuntimeSyncSignature(manifest),\n    );\n    if (onProjectCreated) await onProjectCreated(slug);\n",
)
replace(
    'src/host/orchestrator/projectManager.ts',
    "  /*** Apply system-owned manifest templates and persist the normalized project manifest without regenerating route files. */\n",
    "  /*** Resolve runtime projection currency for one persisted project without exposing its internal signature evidence. */\n  async getProjectRuntimeProjectionState(projectId: string) {\n    const manifest = await this.getProjectManifest(projectId);\n    return this.generationState.readRuntimeProjectionStateAsync(\n      getProjectPath(this.rootPath, projectId),\n      createStudioRuntimeSyncSignature(manifest),\n    );\n  }\n\n  /*** Apply system-owned manifest templates and persist the normalized project manifest without regenerating route files. */\n",
)
replace(
    'src/host/orchestrator/projectManager.ts',
    "    if (regenerateRouterFiles) {\n      const includeStudio = await this.shouldIncludeStudio(projectPath);\n      await this.syncProjectScaffold(projectPath, projectId, updated, includeStudio, runtimePlan);\n      await this.writeGeneratedFiles(projectPath, updated, mutations, {\n        includeStudio,\n        operation: 'sync',\n        runtimePlan,\n      });\n      await this.dependencies.reconcileProjectPackageRootAsync(projectPath);\n    }\n",
    "    if (regenerateRouterFiles) {\n      await this.synchronizeRuntimeProjectionAsync({\n        projectPath,\n        projectId,\n        manifest: updated,\n        mutations,\n        includeStudio: await this.shouldIncludeStudio(projectPath),\n        runtimePlan,\n      });\n    }\n",
)
replace(
    'src/host/orchestrator/projectManager.ts',
    "    await this.syncProjectScaffold(\n      projectPath,\n      projectId,\n      manifest,\n      resolvedIncludeStudio,\n      runtimePlan,\n    );\n    await this.writeGeneratedFiles(projectPath, manifest, mutations, {\n      includeStudio: resolvedIncludeStudio,\n      operation: 'sync',\n      runtimePlan,\n    });\n    await this.dependencies.reconcileProjectPackageRootAsync(projectPath);\n    return { success: true };\n",
    "    await this.synchronizeRuntimeProjectionAsync({\n      projectPath,\n      projectId,\n      manifest,\n      mutations,\n      includeStudio: resolvedIncludeStudio,\n      runtimePlan,\n    });\n    return { success: true };\n",
)
replace(
    'src/host/orchestrator/projectManager.ts',
    "  /*** Generate current app files, write them to disk and initialize or reconcile generated-route ownership. */\n",
    "  /*** Execute a complete runtime projection and persist success or failure evidence for the attempted runtime signature. */\n  private async synchronizeRuntimeProjectionAsync(args: {\n    projectPath: string;\n    projectId: string;\n    manifest: AppManifest;\n    mutations: LayoutMutation[];\n    includeStudio: boolean;\n    runtimePlan: ExpoRuntimePlan;\n  }): Promise<void> {\n    const runtimeSignature = createStudioRuntimeSyncSignature(args.manifest);\n    try {\n      await this.syncProjectScaffold(\n        args.projectPath,\n        args.projectId,\n        args.manifest,\n        args.includeStudio,\n        args.runtimePlan,\n      );\n      await this.writeGeneratedFiles(args.projectPath, args.manifest, args.mutations, {\n        includeStudio: args.includeStudio,\n        operation: 'sync',\n        runtimePlan: args.runtimePlan,\n      });\n      await this.dependencies.reconcileProjectPackageRootAsync(args.projectPath);\n      await this.generationState.recordRuntimeProjectionSuccessAsync(\n        args.projectPath,\n        runtimeSignature,\n      );\n    } catch (error) {\n      await this.generationState.recordRuntimeProjectionFailureAsync(\n        args.projectPath,\n        runtimeSignature,\n      );\n      throw error;\n    }\n  }\n\n  /*** Generate current app files, write them to disk and initialize or reconcile generated-route ownership. */\n",
)
replace(
    'src/host/orchestrator/projectManager.ts',
    '    return requested ?? (await readProjectStudioInclusion(projectPath));\n',
    '    return requested ?? (await this.generationState.readStudioInclusionAsync(projectPath));\n',
)
replace(
    'src/host/orchestrator/projectManager.ts',
    '    await writeProjectStudioInclusion(projectPath, includeStudio);\n',
    '    await this.generationState.writeStudioInclusionAsync(projectPath, includeStudio);\n',
)

replace(
    'src/host/http/server.ts',
    "  // GET manifest\n",
    "  fastify.get(\n    '/api/projects/:id/runtime/projection',\n    async (req: FastifyRequest, reply: FastifyReply) => {\n      const { id } = req.params as { id: string };\n      try {\n        return await projectManager.getProjectRuntimeProjectionState(id);\n      } catch (err: unknown) {\n        const message = err instanceof Error ? err.message : String(err);\n        return reply.status(500).send({ error: message });\n      }\n    },\n  );\n\n  // GET manifest\n",
)

replace(
    'src/index.ts',
    "export type {\n  ProjectAuthDiagnostic,\n",
    "export type {\n  StudioRuntimeProjectionReason,\n  StudioRuntimeProjectionState,\n  StudioRuntimeProjectionStatus,\n} from './types/project-generation';\nexport type {\n  ProjectAuthDiagnostic,\n",
)
replace(
    'src/index.ts',
    "  'StudioModuleState',\n",
    "  'StudioModuleState',\n  'StudioRuntimeProjectionState',\n",
)
replace(
    'src/index.ts',
    "export type StudioSaveStatus = 'idle' | 'saving' | 'saved' | 'error';\n",
    "/*** Report canonical manifest persistence only; runtime projection currency is exposed separately by the host project state. */\nexport type StudioSaveStatus = 'idle' | 'saving' | 'saved' | 'error';\n",
)

replace(
    'src/host/index.ts',
    "export type { ProjectDeployRuntimeInput } from '../projectDeployRuntimeInput';\n",
    "export type { ProjectDeployRuntimeInput } from '../projectDeployRuntimeInput';\nexport type {\n  StudioRuntimeProjectionReason,\n  StudioRuntimeProjectionState,\n  StudioRuntimeProjectionStatus,\n} from '../types/project-generation';\n",
)

write(
    'src/host/orchestrator/projectManagerCurrentState.test.ts',
    """import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { AppManifest } from '@ankhorage/contracts';
import { afterEach, describe, expect, it } from 'bun:test';

import { ProjectGenerationStateStore } from '../../features/projects/adapters/outbound/ProjectGenerationStateStore';
import { createStudioRuntimeSyncSignature } from '../../manifestSync';
import { GeneratedRouteFileOwnership } from './GeneratedRouteFileOwnership';
import { ProjectManager } from './projectManager';

const workspaceRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    workspaceRoots
      .splice(0)
      .map((workspaceRoot) => fs.rm(workspaceRoot, { recursive: true, force: true })),
  );
});

describe('ProjectManager current generation state', () => {
  it('rejects a missing route ledger before persisting a manifest save', async () => {
    const { manager, manifest, projectPath } = await createProjectHarness();

    const error = await catchErrorAsync(
      manager.saveProjectManifest({
        projectId: 'demo',
        manifest: { ...manifest, metadata: { ...manifest.metadata, name: 'Unsynced edit' } },
        mutations: [],
      }),
    );

    expect(error).toBeInstanceOf(Error);
    expect(error instanceof Error ? error.message : '').toContain(
      'Project route ownership state is missing',
    );
    expect(
      JSON.parse(await fs.readFile(path.join(projectPath, 'ankh.config.json'), 'utf8')),
    ).toEqual(manifest);
  });

  it('rejects missing target state before persisting a manifest save', async () => {
    const { manager, manifest, projectPath } = await createProjectHarness();
    await new GeneratedRouteFileOwnership().initialize(projectPath, ['src/app/_layout.tsx']);
    const { deploy: _deploy, ...targetlessManifest } = manifest;

    const error = await catchErrorAsync(
      manager.saveProjectManifest({
        projectId: 'demo',
        manifest: targetlessManifest,
        mutations: [],
      }),
    );

    expect(error).toBeInstanceOf(Error);
    expect(error instanceof Error ? error.message : '').toContain(
      "Project 'demo' is missing canonical deploy.targets generation state.",
    );
    expect(
      JSON.parse(await fs.readFile(path.join(projectPath, 'ankh.config.json'), 'utf8')),
    ).toEqual(manifest);
  });

  it('reports a runtime-relevant persisted manifest edit as pending without running projection effects', async () => {
    const { manager, manifest } = await createProjectHarness();

    await manager.persistProjectManifest({
      projectId: 'demo',
      manifest: {
        ...manifest,
        navigator: { ...manifest.navigator, type: 'tabs' },
      },
    });

    expect(await manager.getProjectRuntimeProjectionState('demo')).toEqual({
      status: 'pending',
      reason: 'manifest-changed',
    });
  });

  it('keeps runtime projection current after persistence-only edits outside the runtime signature', async () => {
    const { manager, manifest } = await createProjectHarness();

    await manager.persistProjectManifest({
      projectId: 'demo',
      manifest: { ...manifest, metadata: { ...manifest.metadata, name: 'Renamed Demo' } },
    });

    expect(await manager.getProjectRuntimeProjectionState('demo')).toEqual({
      status: 'current',
      reason: 'applied',
    });
  });

  it('keeps a failed runtime projection visible across a later manifest-only persistence', async () => {
    const { manager, manifest, projectPath } = await createProjectHarness({
      failReconciliation: true,
    });
    await new GeneratedRouteFileOwnership().initialize(projectPath, ['src/app/_layout.tsx']);
    const runtimeManifest: AppManifest = {
      ...manifest,
      navigator: { ...manifest.navigator, type: 'tabs' },
    };

    const error = await catchErrorAsync(
      manager.saveProjectManifest({
        projectId: 'demo',
        manifest: runtimeManifest,
        mutations: [],
      }),
    );

    expect(error).toBeInstanceOf(Error);
    expect(await manager.getProjectRuntimeProjectionState('demo')).toEqual({
      status: 'failed',
      reason: 'projection-failed',
    });

    await manager.persistProjectManifest({
      projectId: 'demo',
      manifest: {
        ...runtimeManifest,
        metadata: { ...runtimeManifest.metadata, name: 'Still Failed Demo' },
      },
    });

    expect(await manager.getProjectRuntimeProjectionState('demo')).toEqual({
      status: 'failed',
      reason: 'projection-failed',
    });
  });
});

/*** Capture one asynchronous test failure without changing its error value. */
async function catchErrorAsync(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    return error;
  }
}

/*** Create one normalized project fixture with explicit Studio inclusion and successful runtime evidence. */
async function createProjectHarness(
  options: { readonly failReconciliation?: boolean } = {},
): Promise<{
  manager: ProjectManager;
  manifest: AppManifest;
  projectPath: string;
}> {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ankh-current-state-'));
  workspaceRoots.push(workspaceRoot);
  const projectPath = path.join(workspaceRoot, 'apps', 'demo');
  await fs.mkdir(projectPath, { recursive: true });
  await fs.writeFile(path.join(projectPath, 'package.json'), '{"name":"demo"}\n', 'utf8');
  await fs.writeFile(
    path.join(projectPath, 'ankh.config.json'),
    `${JSON.stringify(createManifest(), null, 2)}\n`,
    'utf8',
  );
  const manager = new ProjectManager(
    workspaceRoot,
    options.failReconciliation
      ? {
          reconcileProjectPackageRootAsync: () =>
            Promise.reject(new Error('forced package reconciliation failure')),
        }
      : {},
  );
  const manifest = await manager.persistProjectManifest({
    projectId: 'demo',
    manifest: createManifest(),
  });
  const generationState = new ProjectGenerationStateStore();
  await generationState.writeStudioInclusionAsync(projectPath, true);
  await generationState.recordRuntimeProjectionSuccessAsync(
    projectPath,
    createStudioRuntimeSyncSignature(manifest),
  );
  return { manager, manifest, projectPath };
}

/*** Create the canonical manifest fixture used by current-generation-state tests. */
function createManifest(): AppManifest {
  return {
    metadata: {
      name: 'Demo',
      slug: 'demo',
      version: '1.0.0',
      category: 'developer_tools',
      themeId: 'default',
    },
    settings: { localization: { defaultLocale: 'en', locales: ['en'] } },
    deploy: { targets: { web: { enabled: true } } },
    infra: {
      environments: {
        local: {
          deployment: {
            compute: { provider: 'local' },
            runtime: { provider: 'minikube' },
          },
        },
      },
      modules: [],
    },
    navigator: { type: 'stack', routes: [] },
    screens: {},
    themes: [],
    activeThemeId: 'default',
  };
}
""",
)

replace(
    'src/host/hostLifecycle.smoke.test.ts',
    ").toEqual({ includeStudio: true });\n",
    ").toMatchObject({\n    includeStudio: true,\n    runtimeProjection: { appliedSignature: expect.any(String) },\n  });\n",
)

replace(
    'docs/generated-project-lifecycle.md',
    "ProjectCreate selects current product defaults, persists them in `ankh.config.json`, records Studio\ninclusion in `.ankh/generation-state.json`, generates the current app output, and initializes\n`.ankh/route-ledger.json` with the files owned by route generation.\n",
    "ProjectCreate selects current product defaults, persists them in `ankh.config.json`, records Studio\ninclusion in `.ankh/generation-state.json`, generates the current app output, and initializes\n`.ankh/route-ledger.json` with the files owned by route generation. After the complete generated\nruntime and package projection succeeds, the same generation-state document records the exact\nruntime-relevant manifest signature that was applied.\n",
)
replace(
    'docs/generated-project-lifecycle.md',
    "Scaffold synchronization similarly updates only current generator-owned files and dependencies.\nApplication-owned source directories and Expo configuration files are outside that ownership.\n",
    "Scaffold synchronization similarly updates only current generator-owned files and dependencies.\nApplication-owned source directories and Expo configuration files are outside that ownership. A\nmanifest whose runtime signature differs from the last applied signature is `pending`; a failed\nprojection records only its attempted signature and remains `failed` across later manifest-only\npersistence. Generation state that predates runtime evidence resolves conservatively as `unknown`.\n",
)

audit_path = Path('docs/apm-update-projection-audit.md')
audit = audit_path.read_text(encoding='utf-8')
audit = audit.replace(
    "successful manifest write is not treated as proof that generated files, dependency state, module\nlifecycle state, or infrastructure are current.\n",
    "successful manifest write is not treated as proof that generated files, dependency state, module\nlifecycle state, or infrastructure are current. Runtime currency is resolved separately from the\ncurrent runtime signature and durable evidence in `.ankh/generation-state.json`.\n",
)
audit_lines = audit.splitlines()
for index, line in enumerate(audit_lines):
    if line.startswith('| Manifest autosave / persistence'):
        audit_lines[index] = "| Manifest autosave / persistence   | `StudioProvider` → `StudioManifestPersistenceCoordinator` → `PUT /manifest` → `ModuleManager.persistProjectManifest` → `ProjectManager.persistProjectManifest` | normalized `ankh.config.json`                                                                            | **None in this path**                                                                                               | UI `saveStatus='saved'` means manifest persistence only; runtime currency resolves independently as `current`, `pending`, `failed`, or `unknown` | `src/core/StudioProvider.ts`, `src/core/studioManifestPersistenceModel.ts`, `src/host/orchestrator/moduleManager.ts`, `src/host/orchestrator/projectManager.ts`, `src/features/projects/adapters/outbound/ProjectGenerationStateStore.ts`, `src/host/http/server.ts` |"
    elif line.startswith('| Full manifest save'):
        audit_lines[index] = "| Full manifest save                | `ModuleManager.saveProjectManifest` → `ProjectManager.saveProjectManifest`                                                                                     | normalized manifest including module lifecycle projection                                                | scaffold, generation-state, route files/ledger, package policy/install/devtools reconciliation, infrastructure sync | Runtime evidence is marked current only after the full projection succeeds; failures persist the attempted runtime signature and propagate        | `src/host/orchestrator/moduleManager.ts`, `src/host/orchestrator/projectManager.ts`, `src/features/projects/adapters/outbound/ProjectGenerationStateStore.ts` |"
    elif line.startswith('| Explicit runtime sync'):
        audit_lines[index] = "| Explicit runtime sync             | project sync HTTP/Studio action → `ModuleManager.syncProject` / `syncProjectRuntime`                                                                           | pending module state may be consumed; generation-state runtime evidence is updated only on completion     | pending module removals, scaffold, generated routes, package reconciliation, infrastructure sync                    | Successful full runtime sync records the applied runtime signature; projection failure remains durable and visible                               | `src/hooks/useProjects.ts`, `src/host/orchestrator/moduleManager.ts`, `src/host/orchestrator/projectManager.ts`, `src/features/projects/adapters/outbound/ProjectGenerationStateStore.ts` |"
    elif line.startswith('| Module admin manifest mutation'):
        audit_lines[index] = "| Module admin manifest mutation    | module admin runtime → `mutateModuleAdminManifestField` → `persistProjectManifest`                                                                             | manifest field only                                                                                      | **None in this path**                                                                                               | Runtime-relevant mutations become `pending` through the same signature/evidence comparison; manifest-only success cannot clear prior failure      | `src/host/orchestrator/moduleManager.ts`, `src/host/orchestrator/projectManager.ts`, `src/features/projects/adapters/outbound/ProjectGenerationStateStore.ts` |"
    elif line.startswith('| Studio inclusion generation state'):
        audit_lines[index] = "| Studio generation state           | `ProjectGenerationStateStore`                                                                                                                                  | `.ankh/generation-state.json`                                                                            | owns Studio inclusion plus last-applied/failed runtime signature evidence                                            | Missing runtime evidence is `unknown`; stale evidence cannot report `current`; inclusion writes preserve runtime evidence                         | `src/features/projects/adapters/outbound/ProjectGenerationStateStore.ts`, `docs/generated-project-lifecycle.md` |"
audit = '\n'.join(audit_lines) + '\n'
old_findings = """1. **Autosave completion is narrower than project-currentness.** `StudioManifestPersistenceCoordinator`
   marks the draft saved after the manifest boundary succeeds. Runtime-relevant authoring changes can
   therefore leave generated/runtime/package/infrastructure projections stale until a later full
   save or explicit sync. The owning authoring use case must either maintain the required projection
   immediately or expose explicit pending/failed projection state.
2. **Module admin manifest mutations use the persistence-only path.** They can change runtime-relevant
   node props while bypassing the full generation path. This must be routed through the canonical
   projection-aware operation or explicitly mark pending projection work.
"""
new_findings = """1. **Runtime projection currency is now explicit and durable.** Studio #516 keeps `saveStatus`
   scoped to manifest persistence and resolves runtime currency separately from the runtime-relevant
   manifest signature plus generation-state evidence. Autosave does not run package or infrastructure
   reconciliation just to become green; runtime-relevant drift is `pending`, failed projection remains
   `failed`, successful full projection becomes `current`, and legacy state without evidence is `unknown`.
2. **Module admin manifest mutations share the same currency semantics.** They continue through the
   persistence-only manifest path, so runtime-relevant edits become pending automatically instead of
   reporting project-currentness from manifest success. A later full runtime projection owns clearing
   that state.
"""
if old_findings not in audit:
    raise RuntimeError('Expected audit findings block was not found')
audit = audit.replace(old_findings, new_findings, 1)
old_next = """1. Make runtime-relevant authoring actions maintain their required projections immediately or expose
   explicit pending/failed projection state, including the module-admin persistence-only path.
2. Expose the composed APM lifecycle through authorized Studio host routes without introducing a second
   update engine.
3. Add the Dashboard inspect/status → plan → apply/recovery → verify flow on top of those host routes.
4. Prove the complete existing-app lifecycle from npm-installed Studio and standalone/Ankh CLI without
   sibling source checkouts, including an older-host restart prerequisite.
5. After behavior parity and published-package acceptance, remove `syncProject`, imperative pending-
   apply compatibility and any superseded direct dependency-update path.
"""
new_next = """1. Expose the composed APM lifecycle through authorized Studio host routes without introducing a second
   update engine.
2. Add the Dashboard inspect/status → plan → apply/recovery → verify flow on top of those host routes,
   including explicit host upgrade/restart prerequisites.
3. Prove the complete existing-app lifecycle from npm-installed Studio and standalone/Ankh CLI without
   sibling source checkouts, including an older-host restart prerequisite.
4. After behavior parity and published-package acceptance, remove `syncProject`, imperative pending-
   apply compatibility and any superseded direct dependency-update path.
"""
if old_next not in audit:
    raise RuntimeError('Expected audit next-slice block was not found')
audit_path.write_text(audit.replace(old_next, new_next, 1), encoding='utf-8')

write(
    '.changeset/runtime-projection-currency.md',
    """---
'@ankhorage/studio': patch
---

Track runtime projection currency separately from manifest persistence using the existing generated-project state owner, including durable current, pending, failed, and unknown semantics for runtime-relevant authoring changes.
""",
)
