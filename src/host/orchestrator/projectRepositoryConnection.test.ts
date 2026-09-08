import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { AppManifest } from '@ankhorage/contracts';
import { afterEach, expect, test } from 'bun:test';

import { ProjectManager } from './projectManager';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

test('reconciles generated state before connecting the project with its derived GitHub name', async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'studio-repository-connect-'));
  roots.push(workspaceRoot);
  const projectPath = path.join(workspaceRoot, 'apps', 'demo');
  const events: string[] = [];
  let receivedOptions: unknown;
  await mkdir(path.join(projectPath, '.ankh', 'web-export', 'ankh'), { recursive: true });
  await Promise.all([
    writeFile(
      path.join(projectPath, 'package.json'),
      `${JSON.stringify({ name: '@ankhorage/demo' })}\n`,
      'utf8',
    ),
    writeFile(
      path.join(projectPath, 'ankh.config.json'),
      `${JSON.stringify(createManifest())}\n`,
      'utf8',
    ),
    writeFile(path.join(projectPath, '.gitignore'), 'app-owned-cache/\n', 'utf8'),
    writeFile(
      path.join(projectPath, '.ankh', 'web-export', 'ankh', 'secrets.html'),
      '<html></html>\n',
      'utf8',
    ),
  ]);
  const manager = new ProjectManager(workspaceRoot, {
    reconcileProjectPackageRootAsync: async (receivedPath) => {
      await Promise.resolve();
      expect(receivedPath).toBe(projectPath);
      events.push('reconcile');
    },
    connectGitHubRepositoryAsync: async (options) => {
      await Promise.resolve();
      expect((await readFile(path.join(projectPath, '.gitignore'), 'utf8')).split('\n')).toEqual([
        'app-owned-cache/',
        'node_modules/',
        '.expo/',
        '/.ankh/',
        'dist/',
        'dist-*/',
        'android/',
        'ios/',
        '.env*.local',
        '/infra/minikube/.env',
        '/infra/minikube/.env.example',
        '.DS_Store',
        '',
      ]);
      events.push('connect');
      receivedOptions = options;
      return {
        status: 'connected',
        repository: {
          owner: 'ankhorage',
          name: 'ankhorage-demo-android-ios',
          url: 'https://github.com/ankhorage/ankhorage-demo-android-ios',
          defaultBranch: 'main',
        },
        appCommitSha: 'abc123',
      };
    },
  });

  const result = await manager.connectProjectRepository('demo');

  expect(events).toEqual(['reconcile', 'connect']);
  expect(receivedOptions).toEqual({
    projectPath,
    name: 'ankhorage-demo-android-ios',
    visibility: 'private',
  });
  expect(result.status).toBe('connected');
});

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
    deploy: {
      targets: {
        web: { enabled: true },
        android: { enabled: true, package: 'com.ankh.demo' },
        ios: { enabled: true, bundleIdentifier: 'com.ankh.demo' },
      },
    },
    infra: { modules: [] },
    navigator: { type: 'stack', routes: [] },
    screens: {},
    themes: [],
    activeThemeId: 'default',
  };
}
