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
  it('separates generated relative adapters from package imports', () => {
    const source = createGeneratedAppExtensionRegistrySource({
      usesExpoBarcodeScannerAdapter: true,
      usesExpoReaderSurfaceAdapter: true,
      zoraExtensions: [],
    });

    expect(
      source.startsWith(
        "import type { ComponentRegistry } from '@ankhorage/runtime';\n\n" +
          "import { ExpoBarcodeScannerView } from './expo/ExpoBarcodeScannerView';\n" +
          "import { ExpoReaderSurfaceView } from './expo/ExpoReaderSurfaceView';\n\n",
      ),
    ).toBe(true);
    expect(source).toContain('ReaderSurface: ExpoReaderSurfaceView');
  });

  it('emits an explicit support map beside the generated component registry', () => {
    const source = createGeneratedAppExtensionRegistrySource({
      usesExpoBarcodeScannerAdapter: false,
      usesExpoReaderSurfaceAdapter: false,
      zoraExtensions: [
        {
          packageName: '@example/widgets',
          components: {
            DeclaredWidget: 'DeclaredWidget',
            RegisteredOnlyWidget: 'RegisteredOnlyWidget',
          },
          interactionPolicySupportedComponents: ['DeclaredWidget'],
        },
      ],
    });

    expect(source).toContain('DeclaredWidget: DeclaredWidget');
    expect(source).toContain('RegisteredOnlyWidget: RegisteredOnlyWidget');
    expect(source).toContain('export const APP_EXTENSION_INTERACTION_POLICY_SUPPORT = {');
    expect(source).toContain('DeclaredWidget: true');
    expect(source).not.toContain('RegisteredOnlyWidget: true');
  });

  it('rejects support declarations for node types absent from the registry', () => {
    expect(() =>
      createGeneratedAppExtensionRegistrySource({
        usesExpoBarcodeScannerAdapter: false,
        usesExpoReaderSurfaceAdapter: false,
        zoraExtensions: [
          {
            packageName: '@example/widgets',
            components: { RegisteredWidget: 'RegisteredWidget' },
            interactionPolicySupportedComponents: ['MissingWidget'],
          },
        ],
      }),
    ).toThrow('declares interaction-policy support for unregistered component MissingWidget');
  });

  it('emits an empty declaration instead of inferring support from registry membership', () => {
    const source = createGeneratedAppExtensionRegistrySource({
      usesExpoBarcodeScannerAdapter: false,
      usesExpoReaderSurfaceAdapter: false,
      zoraExtensions: [
        {
          packageName: '@example/widgets',
          components: { RegisteredOnlyWidget: 'RegisteredOnlyWidget' },
        },
      ],
    });

    expect(source).toMatch(
      /export const APP_EXTENSION_INTERACTION_POLICY_SUPPORT = \{\s*\} as const;/,
    );
    expect(source).not.toContain('RegisteredOnlyWidget: true');
  });
});

describe('generated Expo adapter bridges', () => {
  it('installs only the ReaderSurface bridge for an ebook reader plan', async () => {
    const projectPath = await createProjectRoot();

    await syncGeneratedAppFiles(projectPath, {
      runtimePlan: createRuntimePlan(['ExpoReaderSurfaceAdapter']),
    });

    const readerBridge = await fs.readFile(
      path.join(projectPath, 'src/generated/expo/ExpoReaderSurfaceView.tsx'),
      'utf8',
    );
    const registry = await fs.readFile(
      path.join(projectPath, 'src/generated/appExtensionRegistry.ts'),
      'utf8',
    );
    expect(readerBridge).toBe(
      "export { ExpoReaderSurfaceAdapter as ExpoReaderSurfaceView } from '@ankhorage/expo-runtime/reader';\n",
    );
    expect(registry).toContain('ReaderSurface: ExpoReaderSurfaceView');
    expect(registry).not.toContain('BarcodeScannerView');
    expect(
      await pathExists(path.join(projectPath, 'src/generated/expo/ExpoBarcodeScannerView.tsx')),
    ).toBe(false);
  });

  it('removes stale capability bridges when the runtime plan changes', async () => {
    const projectPath = await createProjectRoot();
    await syncGeneratedAppFiles(projectPath, {
      runtimePlan: createRuntimePlan(['ExpoBarcodeScannerAdapter', 'ExpoReaderSurfaceAdapter']),
    });

    await syncGeneratedAppFiles(projectPath, { runtimePlan: createRuntimePlan([]) });

    for (const fileName of ['ExpoBarcodeScannerView.tsx', 'ExpoReaderSurfaceView.tsx']) {
      expect(await pathExists(path.join(projectPath, 'src/generated/expo', fileName))).toBe(false);
    }
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
    expect(source).toContain('"assets/authoring/hero/hero.png"');
    expect(source).toContain('require("../../assets/authoring/hero/hero.png")');
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
