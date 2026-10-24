import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { ExpoRuntimePlan } from '@ankhorage/expo-runtime/planning';
import { afterEach, describe, expect, it } from 'bun:test';

import {
  createGeneratedAppExtensionRegistrySource,
  syncGeneratedAppFiles,
} from './generatedAppFiles';

const projectRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    projectRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe('generated app extension interaction-policy support', () => {
  it('separates the generated scanner adapter from package imports', () => {
    const source = createGeneratedAppExtensionRegistrySource({
      includeStudio: true,
      usesExpoBarcodeScannerAdapter: true,
    });

    expect(
      source.startsWith(
        "import type { ComponentRegistry } from '@ankhorage/runtime';\n\n" +
          "import { ExpoBarcodeScannerView } from './expo/ExpoBarcodeScannerView';\n\n",
      ),
    ).toBe(true);
    expect(source).toContain('BarcodeScannerView: ExpoBarcodeScannerView');
    expect(source).not.toContain('ReaderSurface');
    expect(source).toContain(
      'export const APP_EXTENSION_INTERACTION_POLICY_SUPPORT = {} as const;',
    );
    expect(source).not.toContain('APP_ZORA_PLUGINS');
    expect(source).not.toContain('PLUGIN');
  });

  it('emits an empty adapter registry when no Expo bridge is required', () => {
    const source = createGeneratedAppExtensionRegistrySource({
      includeStudio: false,
      usesExpoBarcodeScannerAdapter: false,
    });

    expect(source).toContain(
      'export const APP_EXTENSION_COMPONENT_REGISTRY: ComponentRegistry = {};',
    );
    expect(source).not.toContain('APP_EXTENSION_INTERACTION_POLICY_SUPPORT');
    expect(source).not.toContain('@ankhorage/zora-');
    expect(source).not.toContain('APP_ZORA_PLUGINS');
  });
});

describe('generated Expo adapter bridges', () => {
  it('uses the normal ZORA Reader without an Expo bridge', async () => {
    const projectPath = await createProjectRoot();
    const obsoleteReaderSurfacePath = path.join(
      projectPath,
      'src/generated/expo/ExpoReaderSurfaceView.tsx',
    );
    await fs.mkdir(path.dirname(obsoleteReaderSurfacePath), { recursive: true });
    await fs.writeFile(obsoleteReaderSurfacePath, 'obsolete bridge\n');

    await syncGeneratedAppFiles(projectPath, {
      runtimePlan: createRuntimePlan([]),
    });

    const registry = await fs.readFile(
      path.join(projectPath, 'src/generated/appExtensionRegistry.ts'),
      'utf8',
    );
    expect(registry).toContain('APP_EXTENSION_COMPONENT_REGISTRY: ComponentRegistry = {};');
    expect(registry).not.toContain('ReaderSurface');
    expect(registry).not.toContain('BarcodeScannerView');
    expect(await pathExists(obsoleteReaderSurfacePath)).toBe(false);
  });

  it('preserves independent files while removing owned Expo adapter bridges', async () => {
    const projectPath = await createProjectRoot();
    const independentFilePath = path.join(
      projectPath,
      'src/generated/expo/IndependentExtension.ts',
    );
    const obsoleteReaderSurfacePath = path.join(
      projectPath,
      'src/generated/expo/ExpoReaderSurfaceView.tsx',
    );
    await fs.mkdir(path.dirname(independentFilePath), { recursive: true });
    await Promise.all([
      fs.writeFile(independentFilePath, 'export const independent = true;\n'),
      fs.writeFile(obsoleteReaderSurfacePath, 'obsolete bridge\n'),
    ]);

    await syncGeneratedAppFiles(projectPath, { runtimePlan: createRuntimePlan([]) });

    expect(await fs.readFile(independentFilePath, 'utf8')).toBe(
      'export const independent = true;\n',
    );
    expect(await pathExists(obsoleteReaderSurfacePath)).toBe(false);
  });

  it('removes stale capability bridges when the runtime plan changes', async () => {
    const projectPath = await createProjectRoot();
    await syncGeneratedAppFiles(projectPath, {
      runtimePlan: createRuntimePlan(['ExpoBarcodeScannerAdapter']),
    });

    await syncGeneratedAppFiles(projectPath, { runtimePlan: createRuntimePlan([]) });

    expect(
      await pathExists(path.join(projectPath, 'src/generated/expo/ExpoBarcodeScannerView.tsx')),
    ).toBe(false);
  });
});

describe('generated bundled media registry', () => {
  it('regenerates static Metro requires from app authoring assets', async () => {
    const projectPath = await createProjectRoot();
    const assetPath = path.join(projectPath, 'assets/authoring/hero/hero.png');
    await fs.mkdir(path.dirname(assetPath), { recursive: true });
    await fs.writeFile(assetPath, new Uint8Array([1]));

    await syncGeneratedAppFiles(projectPath);

    const source = await fs.readFile(
      path.join(projectPath, 'src/generated/bundledMediaRegistry.ts'),
      'utf8',
    );
    expect(source).toContain("'assets/authoring/hero/hero.png'");
    expect(source).toContain("require('../../assets/authoring/hero/hero.png')");
    expect(source).toContain("from '@ankhorage/expo-runtime/bundled-media';");
    expect(source).not.toContain("from '@ankhorage/expo-runtime';");
  });

  it('preserves source directories outside current generated ownership', async () => {
    const projectPath = await createProjectRoot();
    const appOwnedFiles = [
      'src/runtime/app-owned.ts',
      'src/studio/app-owned.ts',
      'src/dnd/app-owned.ts',
    ];
    await Promise.all(
      appOwnedFiles.map(async (relativePath) => {
        const filePath = path.join(projectPath, relativePath);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, 'export const appOwned = true;\n', 'utf8');
      }),
    );

    await syncGeneratedAppFiles(projectPath);

    await Promise.all(
      appOwnedFiles.map(async (relativePath) => {
        expect(await fs.readFile(path.join(projectPath, relativePath), 'utf8')).toBe(
          'export const appOwned = true;\n',
        );
      }),
    );
  });
});

async function createProjectRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ankh-generated-files-'));
  projectRoots.push(root);
  return root;
}

function createRuntimePlan(runtimeAdapters: ExpoRuntimePlan['runtimeAdapters']): ExpoRuntimePlan {
  return {
    capabilities: [],
    dependencies: [],
    diagnostics: [],
    impliedPermissions: [],
    nativeConfig: { androidPermissions: [], configHints: [], plugins: [] },
    needsPermissionsProvider: false,
    permissions: [],
    providers: [],
    runtimeAdapters,
    usesExpoRuntimeRegistry: runtimeAdapters.length > 0,
  };
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false;
    throw error;
  }
}
