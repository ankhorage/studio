import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, test } from 'bun:test';

import {
  createBundledAuthoringMediaPath,
  ProjectBundledMediaService,
} from './projectBundledMediaService';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe('ProjectBundledMediaService', () => {
  test('writes trusted bytes into project assets and returns a canonical bundled source', async () => {
    const root = await createWorkspaceRoot();
    const service = new ProjectBundledMediaService(root);
    const asset = await service.bundle('demo', {
      assetId: '../ Hero Image /',
      name: '../../Hero Image.png',
      kind: 'image',
      body: new Uint8Array([1, 2, 3]),
      contentType: 'image/png',
      width: 1200,
      height: 800,
    });

    const bundledPath = 'assets/authoring/Hero-Image/Hero-Image.png';
    expect(asset).toMatchObject({
      id: '../ Hero Image /',
      source: { kind: 'bundled', path: bundledPath },
      metadata: {
        originalFileName: '../../Hero Image.png',
        sizeBytes: 3,
        width: 1200,
        height: 800,
      },
    });
    expect(
      new Uint8Array(await fs.readFile(path.join(root, 'apps/demo', ...bundledPath.split('/')))),
    ).toEqual(new Uint8Array([1, 2, 3]));
    const registry = await fs.readFile(
      path.join(root, 'apps/demo/src/generated/bundledMediaRegistry.ts'),
      'utf8',
    );
    expect(registry).toContain(bundledPath);
  });

  test('removes a bundled authoring source and regenerates the registry', async () => {
    const root = await createWorkspaceRoot();
    const service = new ProjectBundledMediaService(root);
    const asset = await service.bundle('demo', {
      assetId: 'hero',
      name: 'hero.png',
      kind: 'image',
      body: new Uint8Array([1]),
    });

    if (asset.source.kind !== 'bundled') throw new Error('Expected bundled source.');
    await service.remove('demo', asset.source);

    const projectPath = path.join(root, 'apps/demo');
    expect(await exists(path.join(projectPath, asset.source.path))).toBe(false);
    expect(await exists(path.join(projectPath, 'assets/authoring/hero'))).toBe(false);
    const registry = await fs.readFile(
      path.join(projectPath, 'src/generated/bundledMediaRegistry.ts'),
      'utf8',
    );
    expect(registry).not.toContain(asset.source.path);
  });

  test('preserves a media display name while using its canonical asset filename', async () => {
    const root = await createWorkspaceRoot();
    const service = new ProjectBundledMediaService(root);

    const asset = await service.bundle('demo', {
      assetId: 'hero',
      name: 'Morning grounding sunrise',
      fileName: 'home-hero.webp',
      kind: 'image',
      body: new Uint8Array([1]),
      contentType: 'image/webp',
    });

    expect(asset).toMatchObject({
      name: 'Morning grounding sunrise',
      source: { kind: 'bundled', path: 'assets/authoring/hero/home-hero.webp' },
      metadata: { originalFileName: 'home-hero.webp' },
    });
  });

  test('does not overwrite an existing bundled authoring file', async () => {
    const root = await createWorkspaceRoot();
    const service = new ProjectBundledMediaService(root);
    const input = {
      assetId: 'hero',
      name: 'hero.png',
      kind: 'image' as const,
      body: new Uint8Array([1]),
    };
    await service.bundle('demo', input);
    let failed = false;
    try {
      await service.bundle('demo', input);
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
  });

  test('sanitizes canonical bundled paths', () => {
    expect(createBundledAuthoringMediaPath('../ hero /', '../../my photo.svg')).toBe(
      'assets/authoring/hero/my-photo.svg',
    );
  });
});

async function createWorkspaceRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ankh-bundled-service-'));
  roots.push(root);
  return root;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
