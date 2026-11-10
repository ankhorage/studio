import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from 'bun:test';

const repoRoot = process.cwd();

test('Studio app shell mounts a real Expo Router Stack navigator', async () => {
  const source = await readFile(path.join(repoRoot, 'src/app/StudioApp.tsx'), 'utf8');

  expect(source).toContain("import { router, Stack, usePathname } from 'expo-router';");
  expect(source).toContain('<Stack screenOptions={{ headerShown: false }} />');
  expect(source).not.toContain('<Slot');
});

test('apps/studio exposes the canonical workspace Expo routes', async () => {
  const routes = {
    'src/app/index.tsx': 'ProjectsOverviewScreen',
    'src/app/projects/[projectId].tsx': 'ProjectDetailScreen',
    'src/app/create/index.tsx': 'CreateCategoriesScreen',
    'src/app/create/[category]/index.tsx': 'CreateCategoryTemplatesScreen',
    'src/app/create/[category]/[slug].tsx': 'CreateProjectFromTemplateScreen',
  };

  for (const [routePath, screenName] of Object.entries(routes)) {
    const source = await readFile(path.join(repoRoot, 'apps/studio', routePath), 'utf8');
    expect(source).toContain(`export { ${screenName} as default } from '@ankhorage/studio/app';`);
    expect(source).not.toContain("from '@ankhorage/studio';");
  }
});

test('apps/studio imports its shell from the Reader-free public app entrypoint', async () => {
  const [appEntry, rootLayout, packageJson] = await Promise.all([
    readFile(path.join(repoRoot, 'src/app/index.ts'), 'utf8'),
    readFile(path.join(repoRoot, 'apps/studio/src/app/_layout.tsx'), 'utf8'),
    readFile(path.join(repoRoot, 'package.json'), 'utf8'),
  ]);

  expect(rootLayout).toContain("import { StudioApp } from '@ankhorage/studio/app';");
  expect(rootLayout).not.toContain("from '@ankhorage/studio';");
  expect(appEntry).not.toContain("from '../root");
  expect(appEntry).not.toContain('@ankhorage/reader');
  expect(appEntry).not.toContain('pdfjs-dist');
  expect(packageJson).toContain('"./app"');
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
    '/create/:category/:slug',
  ]);
});
