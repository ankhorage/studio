import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from 'bun:test';

const repoRoot = process.cwd();

test('Studio app shell mounts a real Expo Router Stack navigator', async () => {
  const source = await readFile(path.join(repoRoot, 'src/app/StudioApp.tsx'), 'utf8');

  expect(source).toContain("import { Stack, router, usePathname } from 'expo-router';");
  expect(source).toContain('<Stack screenOptions={{ headerShown: false }} />');
  expect(source).not.toContain('<Slot');
});

test('apps/studio exposes the canonical workspace Expo routes', async () => {
  const routes = {
    'src/app/index.tsx': 'ProjectsOverviewScreen',
    'src/app/projects/[projectId].tsx': 'ProjectDetailScreen',
    'src/app/create/index.tsx': 'CreateCategoriesScreen',
    'src/app/create/[category]/index.tsx': 'CreateCategoryTemplatesScreen',
    'src/app/create/[category]/[templateId].tsx': 'CreateProjectFromTemplateScreen',
  };

  for (const [routePath, screenName] of Object.entries(routes)) {
    const source = await readFile(path.join(repoRoot, 'apps/studio', routePath), 'utf8');
    expect(source).toContain(`export { ${screenName} as default } from '@ankhorage/studio';`);
  }
});

test('apps/studio owns a canonical AppManifest for the Studio workspace app', async () => {
  const manifest = JSON.parse(
    await readFile(path.join(repoRoot, 'apps/studio/ankh.config.json'), 'utf8'),
  ) as {
    metadata?: { category?: string; slug?: string };
    navigator?: { type?: string; routes?: { path?: string }[] };
  };

  expect(manifest.metadata?.slug).toBe('ankhorage-studio');
  expect(manifest.metadata?.category).toBe('developer_tools');
  expect(manifest.navigator?.type).toBe('stack');
  expect(manifest.navigator?.routes?.map((route) => route.path)).toEqual([
    '/',
    '/projects/:projectId',
    '/create',
    '/create/:category',
    '/create/:category/:templateId',
  ]);
});
