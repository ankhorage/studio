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
    'src/host/orchestrator/projectManagerCurrentState.test.ts',
    r'''import { promises as fs } from 'node:fs';
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
''',
)

server_route = """  fastify.get(
    '/api/projects/:id/runtime/projection',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string };
      try {
        return await projectManager.getProjectRuntimeProjectionState(id);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return reply.status(500).send({ error: message });
      }
    },
  );

"""
replace('src/host/http/server.ts', server_route, '')

write(
    'src/host/http/projectRuntimeRoutes.ts',
    """import type { FastifyInstance, FastifyReply } from 'fastify';

import type { ProjectManager } from '../orchestrator/projectManager';

type ProjectRuntimeManager = Pick<
  ProjectManager,
  'getProjectRuntimeProjectionState' | 'upInfrastructure'
>;

/*** Register project runtime status and provider-neutral infrastructure recovery HTTP adapters. */
export function registerProjectRuntimeRoutes(
  fastify: FastifyInstance,
  options: {
    readonly projectManager: ProjectRuntimeManager;
    readonly workspaceRoot: string;
  },
): void {
  /*** Report bounded runtime projection currency for the project's currently persisted manifest. */
  fastify.get('/api/projects/:id/runtime/projection', async (request, reply) => {
    const { id } = request.params as { readonly id: string };
    try {
      return await options.projectManager.getProjectRuntimeProjectionState(id);
    } catch (error: unknown) {
      return sendRuntimeFailure(reply, error);
    }
  });

  /*** Reconcile the project's local infrastructure environment to its desired running state. */
  fastify.post('/api/projects/:id/infra/runtime/ensure', async (request, reply) => {
    const { id } = request.params as { readonly id: string };
    try {
      const reconciled = await options.projectManager.upInfrastructure(id);
      return { success: true, reconciled };
    } catch (error: unknown) {
      return sendRuntimeFailure(reply, error);
    }
  });
}

/*** Translate a project runtime failure into the bounded Studio HTTP response. */
function sendRuntimeFailure(reply: FastifyReply, error: unknown): unknown {
  const message = error instanceof Error ? error.message : String(error);
  return reply.status(500).send({ error: message });
}
""",
)

write(
    'src/host/http/projectRuntimeRoutes.test.ts',
    """import { afterEach, describe, expect, test } from 'bun:test';
import Fastify, { type FastifyInstance } from 'fastify';

import { registerProjectRuntimeRoutes } from './projectRuntimeRoutes';

const servers: FastifyInstance[] = [];
const ledger = {
  schemaVersion: 1 as const,
  projectId: 'project-one',
  environment: 'local' as const,
  targets: [],
  resources: [],
  outputs: [],
  artifacts: [],
};

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe('project runtime HTTP adapter', () => {
  test('returns bounded runtime projection currency from ProjectManager', async () => {
    const calls: string[] = [];
    const server = Fastify({ logger: false });
    registerProjectRuntimeRoutes(server, {
      workspaceRoot: '/workspace',
      projectManager: {
        getProjectRuntimeProjectionState: (projectId) => {
          calls.push(projectId);
          return Promise.resolve({ status: 'pending', reason: 'manifest-changed' });
        },
        upInfrastructure: () => Promise.reject(new Error('not used')),
      },
    });
    servers.push(server);

    const response = await server.inject({
      method: 'GET',
      url: '/api/projects/project-one/runtime/projection',
    });

    expect(response.statusCode).toBe(200);
    expect(calls).toEqual(['project-one']);
    expect(JSON.parse(response.body) as unknown).toEqual({
      status: 'pending',
      reason: 'manifest-changed',
    });
  });

  test('reconciles through the provider-neutral ProjectManager lifecycle', async () => {
    const calls: string[] = [];
    const server = Fastify({ logger: false });
    registerProjectRuntimeRoutes(server, {
      workspaceRoot: '/workspace',
      projectManager: {
        getProjectRuntimeProjectionState: () =>
          Promise.resolve({ status: 'current', reason: 'applied' }),
        upInfrastructure: (projectId) => {
          calls.push(projectId);
          return Promise.resolve({
            environment: 'local',
            targets: [],
            resources: [],
            outputs: [],
            ledger,
          });
        },
      },
    });
    servers.push(server);

    const response = await server.inject({
      method: 'POST',
      url: '/api/projects/project-one/infra/runtime/ensure',
    });

    expect(response.statusCode).toBe(200);
    expect(calls).toEqual(['project-one']);
    expect(JSON.parse(response.body) as unknown).toEqual({
      success: true,
      reconciled: {
        environment: 'local',
        targets: [],
        resources: [],
        outputs: [],
        ledger,
      },
    });
  });

  test('returns a bounded error for lifecycle failures', async () => {
    const server = Fastify({ logger: false });
    registerProjectRuntimeRoutes(server, {
      workspaceRoot: '/workspace',
      projectManager: {
        getProjectRuntimeProjectionState: () =>
          Promise.resolve({ status: 'current', reason: 'applied' }),
        upInfrastructure: () => Promise.reject(new Error('runtime unavailable')),
      },
    });
    servers.push(server);

    const response = await server.inject({
      method: 'POST',
      url: '/api/projects/project-one/infra/runtime/ensure',
    });

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body) as unknown).toEqual({ error: 'runtime unavailable' });
  });
});
""",
)
