import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { AppManifest } from '@ankhorage/contracts';
import { expect, test } from 'bun:test';

import { ProjectManager } from './projectManager';

test('deleteProject destroys generated Infra before image cleanup and project file removal', async () => {
  const rootPath = await createWorkspace();
  await createProject(rootPath, 'demo');
  const calls: string[] = [];
  const manager = new ProjectManager(rootPath, {
    runProjectInfraScript: (args) => {
      calls.push(`destroy:${args.projectId}:${args.script}`);
      return Promise.resolve();
    },
    cleanupProjectGeneratedAppImage: (args) => {
      calls.push(`cleanup:${args.projectId}:${args.target}`);
      return Promise.resolve({ removedImages: 1, warnings: ['cleanup-warning'] });
    },
  });

  const result = await manager.deleteProject('demo');

  expect(result).toEqual({
    success: true,
    infraDestroyed: true,
    projectFilesDeleted: true,
    imageCleanup: { removedImages: 1, warnings: ['cleanup-warning'] },
    warnings: ['cleanup-warning'],
  });
  expect(calls).toEqual(['destroy:demo:destroy', 'cleanup:demo:minikube']);
  await expectRejects(() => readFile(path.join(rootPath, 'apps', 'demo', 'package.json'), 'utf8'));
});

test('deleteProject fails clearly and preserves files when generated destroy fails', async () => {
  const rootPath = await createWorkspace();
  await createProject(rootPath, 'demo');
  const manager = new ProjectManager(rootPath, {
    runProjectInfraScript: () => Promise.reject(new Error('destroy failed')),
    cleanupProjectGeneratedAppImage: () => {
      throw new Error('cleanup should not run');
    },
  });

  await expectRejects(
    () => manager.deleteProject('demo'),
    /Infrastructure teardown failed for project 'demo': destroy failed/u,
  );
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
    runProjectInfraScript: (args) => {
      destroyed.push(args.projectId);
      return Promise.resolve();
    },
    cleanupProjectGeneratedAppImage: () =>
      Promise.resolve({ removedImages: 0, warnings: [], skipped: { reason: 'disabled' } }),
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

async function createWorkspace(): Promise<string> {
  const rootPath = await mkdtemp(path.join(tmpdir(), 'ankh-studio-delete-'));
  await mkdir(path.join(rootPath, 'apps', 'studio'), { recursive: true });
  await writeFile(
    path.join(rootPath, 'package.json'),
    JSON.stringify({ name: '@ankhorage/studio-test', private: true, workspaces: ['apps/*'] }),
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
      themeId: 'default',
    },
    settings: {
      localization: {
        defaultLocale: 'en',
        locales: ['en'],
      },
    },
    infra: {
      deployment: {
        target: 'minikube',
        monitoring: false,
      },
      auth: {
        scope: 'global',
        provider: 'supabase',
      },
      database: {
        provider: 'supabase',
        tier: 'dev',
      },
      storage: {
        provider: 'auto',
        buckets: ['avatars'],
      },
      secretStore: {
        provider: 'supabase-vault',
      },
      plugins: [],
    },
    navigator: {
      type: 'stack',
      initialRouteName: 'index',
      routes: [{ name: 'index', screenId: 'index' }],
    },
    screens: {
      index: {
        id: 'index',
        name: 'Index',
        root: {
          id: 'root',
          type: 'Page',
        },
      },
    },
    themes: [],
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
    if (expectedMessage) {
      expect((error as Error).message).toMatch(expectedMessage);
    }
  }
}
