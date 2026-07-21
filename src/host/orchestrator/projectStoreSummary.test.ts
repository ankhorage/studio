import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, test } from 'bun:test';

import { ProjectStore } from './projectStore';

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
      infra: { plugins: [] },
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
