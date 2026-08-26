import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { AppCategory, AppManifest } from '@ankhorage/contracts';

export async function createExpo57StudioHostFixtureAsync(
  workspaceRoot: string,
  category: AppCategory,
): Promise<void> {
  const projectRoot = path.join(workspaceRoot, 'apps', 'release-monitor');
  await mkdir(projectRoot, { recursive: true });
  await Promise.all([
    writeFile(
      path.join(workspaceRoot, 'package.json'),
      `${JSON.stringify(
        {
          name: '@ankhorage/studio-standalone-host-fixture',
          private: true,
          workspaces: ['apps/*'],
        },
        null,
        2,
      )}\n`,
      'utf8',
    ),
    writeFile(
      path.join(projectRoot, 'package.json'),
      `${JSON.stringify({ name: 'release-monitor', private: true, version: '1.0.0' }, null, 2)}\n`,
      'utf8',
    ),
    writeFile(
      path.join(projectRoot, 'ankh.config.json'),
      `${JSON.stringify(createManifest(category), null, 2)}\n`,
      'utf8',
    ),
  ]);
}

function createManifest(category: AppCategory): AppManifest {
  return {
    metadata: {
      name: 'Release Monitor',
      slug: 'release-monitor',
      version: '1.0.0',
      category,
      themeId: 'standalone-theme',
      created: '2026-01-01T00:00:00.000Z',
      updated: '2026-01-02T00:00:00.000Z',
    },
    themes: [
      {
        id: 'standalone-theme',
        name: 'Standalone Theme',
        light: { primaryColor: '#2563eb', harmony: 'analogous' },
        dark: { primaryColor: '#60a5fa', harmony: 'analogous' },
      },
    ],
    activeThemeId: 'standalone-theme',
    activeThemeMode: 'dark',
    infra: {
      modules: [],
      deployment: { target: 'minikube', monitoring: false },
      storage: { provider: 'auto', buckets: ['public'] },
      networking: { cdn: false },
    },
    navigator: {
      type: 'stack',
      initialRouteName: 'index',
      routes: [{ name: 'index', label: 'Overview', screenId: 'index' }],
    },
    screens: {
      index: {
        id: 'index',
        name: 'Overview',
        root: { id: 'index-root', type: 'Page', props: { title: 'Release Monitor' } },
      },
    },
    settings: { localization: { defaultLocale: 'en', locales: ['en'] } },
  };
}
