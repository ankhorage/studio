import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { AppManifest } from '@ankhorage/contracts';
import { expect, test } from 'bun:test';

import { ProjectManifestNotFoundError, ProjectStore } from './projectStore';

test('project summary reads canonical category, active theme, and timestamps', async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'studio-project-summary-'));
  const projectRoot = path.join(workspaceRoot, 'apps', 'demo');
  await mkdir(projectRoot, { recursive: true });
  await writeFile(path.join(projectRoot, 'package.json'), JSON.stringify({ name: 'demo' }));
  await writeFile(
    path.join(projectRoot, 'ankh.config.json'),
    JSON.stringify({
      metadata: {
        name: 'Demo',
        slug: 'demo',
        version: '1.2.3',
        category: 'developer_tools',
        themeId: 'default',
        created: '2026-01-01T00:00:00.000Z',
        updated: '2026-01-02T00:00:00.000Z',
      },
      themes: [
        {
          id: 'default',
          name: 'Default',
          light: { primaryColor: '#2563eb', harmony: 'analogous' },
          dark: { primaryColor: '#60a5fa', harmony: 'analogous' },
        },
      ],
      activeThemeId: 'default',
      activeThemeMode: 'dark',
      infra: { modules: [] },
      navigator: { type: 'stack', routes: [] },
      screens: {},
      settings: { localization: { defaultLocale: 'en', locales: ['en'] } },
    }),
  );

  const projects = await new ProjectStore(workspaceRoot).listProjects();

  expect(projects).toHaveLength(1);
  expect(projects[0]).toMatchObject({
    id: 'demo',
    name: 'Demo',
    version: '1.2.3',
    category: 'developer_tools',
    created: '2026-01-01T00:00:00.000Z',
    updated: '2026-01-02T00:00:00.000Z',
    activeThemeMode: 'dark',
    activeTheme: { id: 'default', name: 'Default' },
  });
});

test('missing project manifests are rejected instead of synthesized', async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'studio-project-missing-manifest-'));
  const projectRoot = path.join(workspaceRoot, 'apps', 'demo');
  await mkdir(projectRoot, { recursive: true });
  await writeFile(path.join(projectRoot, 'package.json'), JSON.stringify({ name: 'demo' }));

  const store = new ProjectStore(workspaceRoot);
  const error = await catchError(store.readManifest('demo'));

  expect(error).toBeInstanceOf(ProjectManifestNotFoundError);
  expect(error instanceof Error ? error.message : '').toContain(
    "Project 'demo' is missing canonical ankh.config.json.",
  );
});

test('canonical writes persist ankh.config.json', async () => {
  const workspaceRoot = await createProjectWorkspace('canonical-write');
  const store = new ProjectStore(workspaceRoot);
  await store.writeManifest('demo', createManifest('Canonical'));

  const projectRoot = path.join(workspaceRoot, 'apps', 'demo');
  const persisted = await store.readManifest('demo');

  expect(persisted.metadata.name).toBe('Canonical');
  expect(JSON.parse(await readFile(path.join(projectRoot, 'ankh.config.json'), 'utf8'))).toEqual(
    persisted,
  );
});

async function createProjectWorkspace(prefix: string): Promise<string> {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), `${prefix}-`));
  const projectRoot = path.join(workspaceRoot, 'apps', 'demo');
  await mkdir(projectRoot, { recursive: true });
  await writeFile(path.join(projectRoot, 'package.json'), JSON.stringify({ name: 'demo' }));
  return workspaceRoot;
}

function createManifest(name: string): AppManifest {
  return {
    metadata: {
      name,
      slug: 'demo',
      version: '1.0.0',
      category: 'developer_tools',
      themeId: 'default',
    },
    themes: [
      {
        id: 'default',
        name: 'Default',
        light: { primaryColor: '#2563eb', harmony: 'analogous' },
        dark: { primaryColor: '#60a5fa', harmony: 'analogous' },
      },
    ],
    activeThemeId: 'default',
    infra: { modules: [] },
    navigator: { type: 'stack', routes: [] },
    screens: {},
    settings: { localization: { defaultLocale: 'en', locales: ['en'] } },
  };
}

async function catchError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
    return null;
  } catch (caught) {
    return caught;
  }
}
