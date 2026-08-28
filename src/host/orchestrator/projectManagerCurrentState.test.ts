import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { AppManifest } from '@ankhorage/contracts';
import { afterEach, describe, expect, it } from 'bun:test';

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

    await expect(
      manager.saveProjectManifest({
        projectId: 'demo',
        manifest: { ...manifest, metadata: { ...manifest.metadata, name: 'Unsynced edit' } },
        mutations: [],
      }),
    ).rejects.toThrow('Project route ownership state is missing');

    expect(
      JSON.parse(await fs.readFile(path.join(projectPath, 'ankh.config.json'), 'utf8')),
    ).toEqual(manifest);
  });

  it('rejects missing target state before persisting a manifest save', async () => {
    const { manager, manifest, projectPath } = await createProjectHarness();
    await new GeneratedRouteFileOwnership().initialize(projectPath, ['src/app/_layout.tsx']);
    const { deploy: _deploy, ...targetlessManifest } = manifest;

    await expect(
      manager.saveProjectManifest({
        projectId: 'demo',
        manifest: targetlessManifest,
        mutations: [],
      }),
    ).rejects.toThrow("Project 'demo' is missing canonical deploy.targets generation state.");

    expect(
      JSON.parse(await fs.readFile(path.join(projectPath, 'ankh.config.json'), 'utf8')),
    ).toEqual(manifest);
  });
});

async function createProjectHarness(): Promise<{
  manager: ProjectManager;
  manifest: AppManifest;
  projectPath: string;
}> {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ankh-current-state-'));
  workspaceRoots.push(workspaceRoot);
  const projectPath = path.join(workspaceRoot, 'apps', 'demo');
  const manifest = createManifest();
  await fs.mkdir(projectPath, { recursive: true });
  await fs.writeFile(path.join(projectPath, 'package.json'), '{"name":"demo"}\n', 'utf8');
  await fs.writeFile(
    path.join(projectPath, 'ankh.config.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  return { manager: new ProjectManager(workspaceRoot), manifest, projectPath };
}

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
    infra: { modules: [] },
    navigator: { type: 'stack', routes: [] },
    screens: {},
    themes: [],
    activeThemeId: 'default',
  };
}
