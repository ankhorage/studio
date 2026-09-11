import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { AppManifest } from '@ankhorage/contracts';
import { afterEach, expect, test } from 'bun:test';

import { createSmokeProjectSource } from '../smoke/createSmokeProjectSource';
import { getProjectTemplateSource } from '../templates';
import { ProjectManager } from './projectManager';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

test('materializes project creation assets and persists their bundled media sources', async () => {
  const workspaceRoot = await createWorkspaceRoot();
  const base = createSmokeProjectSource();
  const manifest: AppManifest = {
    ...base.manifest,
    media: {
      assets: {
        hero: {
          id: 'hero',
          name: 'Hero.png',
          kind: 'image',
          contentType: 'image/webp',
          source: { kind: 'bundled', path: 'assets/images/hero.png' },
        },
      },
    },
    splashScreen: {
      backgroundColor: '#111111',
      image: { mediaId: 'hero' },
      imageWidth: 240,
      resizeMode: 'contain',
      dark: {
        backgroundColor: '#000000',
        image: { mediaId: 'hero' },
        imageWidth: 240,
        resizeMode: 'contain',
      },
    },
  };
  const manager = new ProjectManager(workspaceRoot, {
    reconcileProjectPackageRootAsync: async () => {
      await Promise.resolve();
    },
  });

  const created = await manager.createProject('Asset Template', {
    manifest,
    assets: [
      {
        assetId: 'hero',
        name: 'Hero.png',
        fileName: 'hero.webp',
        kind: 'image',
        body: new Uint8Array([1, 2, 3]),
        contentType: 'image/webp',
        width: 1200,
        height: 800,
      },
    ],
  });

  const createdManifest = await manager.getProjectManifest(created.id);
  const hero = createdManifest.media?.assets.hero;
  expect(hero).toBeDefined();
  if (hero?.source.kind !== 'bundled') throw new Error('Expected bundled hero media.');
  expect(hero.name).toBe('Hero.png');
  expect(hero.source.path).toBe('assets/authoring/hero/hero.webp');
  expect(hero.metadata).toMatchObject({ originalFileName: 'hero.webp' });
  expect(hero.metadata).toMatchObject({ sizeBytes: 3, width: 1200, height: 800 });
  expect(new Uint8Array(await readFile(path.join(created.path, hero.source.path)))).toEqual(
    new Uint8Array([1, 2, 3]),
  );

  const appConfig = await readFile(path.join(created.path, 'app.config.ts'), 'utf8');
  expect(appConfig).toContain("image: './assets/authoring/hero/hero.webp'");
  expect(appConfig).not.toContain('mediaId');
  expect(appConfig).not.toContain('assets/images/hero.png');
});

test('projects SharkPrey splash artwork to its materialized Expo asset path', async () => {
  const workspaceRoot = await createWorkspaceRoot();
  const source = await getProjectTemplateSource({
    category: 'education_learning',
    slug: 'sharkprey',
  });
  const manager = new ProjectManager(workspaceRoot, {
    reconcileProjectPackageRootAsync: async () => {
      await Promise.resolve();
    },
  });

  const created = await manager.createProject('SharkPrey Splash', source);
  const splashPath = 'assets/authoring/sharkprey-logo/sharkprey-logo.png';
  const appConfig = await readFile(path.join(created.path, 'app.config.ts'), 'utf8');

  expect(appConfig).toContain(`image: './${splashPath}'`);
  expect(appConfig).not.toContain('mediaId');
  expect((await readFile(path.join(created.path, splashPath))).byteLength).toBeGreaterThan(0);
});

async function createWorkspaceRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'studio-create-assets-'));
  roots.push(root);
  await mkdir(path.join(root, 'apps'), { recursive: true });
  await writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ name: '@ankhorage/studio', private: true }),
  );
  return root;
}
