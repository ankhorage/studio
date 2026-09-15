import { promises as fs } from 'node:fs';
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
        navigator: { type: 'tabs', implementation: 'native', routes: [] },
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
      navigator: { type: 'tabs', implementation: 'native', routes: [] },
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
