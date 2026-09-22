import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { AppManifest } from '@ankhorage/contracts';
import type { InfraLedger } from '@ankhorage/contracts/infra';
import { expect, test } from 'bun:test';

import type { StudioProjectInfraLifecycle } from '../../features/infrastructure/composition/createStudioProjectInfraLifecycle';
import { ProjectManager } from './projectManager';

test('deleteProject destroys generated Infra before project file removal', async () => {
  const rootPath = await createWorkspace();
  await createProject(rootPath, 'demo');
  const calls: string[] = [];
  const manager = new ProjectManager(rootPath, {
    infraLifecycle: createInfraLifecycle({
      destroyAsync: (request) => {
        calls.push(`destroy:${request.projectId}:${request.deletePersistentResources}`);
        return Promise.resolve({ environment: 'local', ledger: null });
      },
    }),
  });

  const result = await manager.deleteProject('demo');

  expect(result).toEqual({ success: true, infraDestroyed: true, projectFilesDeleted: true });
  expect(calls).toEqual(['destroy:demo:true']);
  await expectRejects(() => readFile(path.join(rootPath, 'apps', 'demo', 'package.json'), 'utf8'));
});

test('deleteProject removes a project without Infra teardown when no owned resources exist', async () => {
  const rootPath = await createWorkspace();
  await createProject(rootPath, 'demo');
  let destroyCalled = false;
  const manager = new ProjectManager(rootPath, {
    infraLifecycle: createInfraLifecycle({
      hasOwnedResourcesAsync: () => Promise.resolve(false),
      destroyAsync: () => {
        destroyCalled = true;
        return Promise.resolve({ environment: 'local', ledger: null });
      },
    }),
  });

  const result = await manager.deleteProject('demo');

  expect(result).toEqual({ success: true, infraDestroyed: false, projectFilesDeleted: true });
  expect(destroyCalled).toBe(false);
  await expectRejects(() => readFile(path.join(rootPath, 'apps', 'demo', 'package.json'), 'utf8'));
});

test('deleteProject fails clearly and preserves files when Infra destroy fails', async () => {
  const rootPath = await createWorkspace();
  await createProject(rootPath, 'demo');
  const manager = new ProjectManager(rootPath, {
    infraLifecycle: createInfraLifecycle({
      destroyAsync: () => Promise.reject(new Error('destroy failed')),
    }),
  });

  await expectRejects(() => manager.deleteProject('demo'), /destroy failed/u);
  expect(await readFile(path.join(rootPath, 'apps', 'demo', 'package.json'), 'utf8')).toContain(
    '@demo/app',
  );
});

test('deleteProject destroys only the requested project', async () => {
  const rootPath = await createWorkspace();
  await createProject(rootPath, 'demo-a');
  await createProject(rootPath, 'demo-b');
  const destroyed: string[] = [];
  const manager = new ProjectManager(rootPath, {
    infraLifecycle: createInfraLifecycle({
      destroyAsync: (request) => {
        destroyed.push(request.projectId);
        return Promise.resolve({ environment: 'local', ledger: null });
      },
    }),
  });

  await manager.deleteProject('demo-a');

  expect(destroyed).toEqual(['demo-a']);
  await expectRejects(() =>
    readFile(path.join(rootPath, 'apps', 'demo-a', 'package.json'), 'utf8'),
  );
  expect(await readFile(path.join(rootPath, 'apps', 'demo-b', 'package.json'), 'utf8')).toContain(
    '@demo-b/app',
  );
});

function createInfraLifecycle(
  overrides: Partial<StudioProjectInfraLifecycle> = {},
): StudioProjectInfraLifecycle {
  const ledger: InfraLedger = {
    schemaVersion: 1,
    projectId: 'fixture',
    environment: 'local',
    targets: [],
    resources: [],
    outputs: [],
    artifacts: [],
  };
  return {
    generateAsync: () => Promise.resolve({ environment: 'local', artifacts: [], ledger }),
    upAsync: () =>
      Promise.resolve({ environment: 'local', targets: [], resources: [], outputs: [], ledger }),
    statusAsync: (request) =>
      Promise.resolve({
        projectId: request.projectId,
        environment: 'local',
        state: 'ready',
        resources: [],
      }),
    outputsAsync: () => Promise.resolve({ environment: 'local', outputs: [] }),
    downAsync: () => Promise.resolve({ environment: 'local', ledger }),
    hasOwnedResourcesAsync: () => Promise.resolve(true),
    destroyAsync: () => Promise.resolve({ environment: 'local', ledger: null }),
    ...overrides,
  };
}

async function createWorkspace(): Promise<string> {
  const rootPath = await mkdtemp(path.join(tmpdir(), 'ankh-studio-delete-'));
  await mkdir(path.join(rootPath, 'apps', 'studio'), { recursive: true });
  await writeFile(
    path.join(rootPath, 'package.json'),
    JSON.stringify({ name: '@ankhorage/studio-test', private: true }),
  );
  return rootPath;
}

async function createProject(rootPath: string, projectId: string): Promise<void> {
  const projectPath = path.join(rootPath, 'apps', projectId);
  await mkdir(projectPath, { recursive: true });
  await writeFile(
    path.join(projectPath, 'package.json'),
    JSON.stringify({ name: `@${projectId}/app` }),
  );
  await writeFile(
    path.join(projectPath, 'ankh.config.json'),
    JSON.stringify(createManifest(projectId)),
  );
}

function createManifest(projectId: string): AppManifest {
  return {
    metadata: {
      name: projectId,
      slug: projectId,
      version: '1.0.0',
      category: 'developer_tools',
      themeId: 'default',
    },
    settings: { localization: { defaultLocale: 'en', locales: ['en'] } },
    infra: {
      environments: {
        local: {
          deployment: { compute: { provider: 'local' }, runtime: { provider: 'minikube' } },
          auth: { scope: 'global', provider: 'supabase' },
          database: { provider: 'supabase', tier: 'dev' },
          objectStorage: { provider: 'supabase', buckets: { avatars: true } },
          secretStore: { provider: 'supabase-vault' },
        },
      },
      modules: {},
    },
    navigator: {
      type: 'stack',
      initialRouteName: 'index',
      routes: [{ name: 'index', screenId: 'index' }],
    },
    screens: { index: { id: 'index', name: 'Index', root: { id: 'root', type: 'Page' } } },
    themes: {
      default: {
        id: 'default',
        name: 'Default',
        light: { primaryColor: '#3366ff', harmony: 'analogous' },
        dark: { primaryColor: '#6699ff', harmony: 'analogous' },
      },
    },
    activeThemeId: 'default',
  };
}

async function expectRejects(
  operation: () => Promise<unknown>,
  expectedMessage?: RegExp,
): Promise<void> {
  try {
    await operation();
    throw new Error('Expected operation to reject.');
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    if (expectedMessage) expect((error as Error).message).toMatch(expectedMessage);
  }
}
