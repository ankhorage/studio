import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, test } from 'bun:test';

import { syncProjectBundledMediaRegistry } from './projectBundledMediaRegistry';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe('syncProjectBundledMediaRegistry', () => {
  test('maps bundled authoring files to canonical paths and static require literals', async () => {
    const projectPath = await createProjectRoot();
    const assetPath = path.join(projectPath, 'assets/authoring/hero/Hero Image.png');
    await fs.mkdir(path.dirname(assetPath), { recursive: true });
    await fs.writeFile(assetPath, new Uint8Array([1, 2, 3]));

    await syncProjectBundledMediaRegistry(projectPath);

    const source = await fs.readFile(
      path.join(projectPath, 'src/generated/bundledMediaRegistry.ts'),
      'utf8',
    );
    expect(source).toContain('"assets/authoring/hero/Hero Image.png"');
    expect(source).toContain('require("../../assets/authoring/hero/Hero Image.png")');
    expect(source).toContain("from '@ankhorage/expo-runtime/bundled-media';");
    expect(source).not.toContain("from '@ankhorage/expo-runtime';");
  });

  test('writes an empty static registry when the authoring assets directory is absent', async () => {
    const projectPath = await createProjectRoot();
    await syncProjectBundledMediaRegistry(projectPath);

    const source = await fs.readFile(
      path.join(projectPath, 'src/generated/bundledMediaRegistry.ts'),
      'utf8',
    );
    expect(source).toContain('export const bundledMediaRegistry: ExpoBundledMediaRegistry = {');
    expect(source).not.toContain('require(');
  });
});

async function createProjectRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ankh-bundled-media-'));
  roots.push(root);
  return root;
}
